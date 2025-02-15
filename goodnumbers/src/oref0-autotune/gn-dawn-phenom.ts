import { ATReading, AutotunePreppedData } from 'gn-autotune-prep';
import { AssessmentInsight, GlucoseUnits, InsightPriority } from '../types/nightscout';
import { t, u } from '../utils/text';
import { PatientRange } from 'gn-overview';

interface DawnPatternDay {
  date: string;
  startTime: Date;
  startGlucose: number;
  peakGlucose: number;
  timeOfPeak: Date;
  averageDeviation: number;
  totalDeviation: number;
  duration: number; // minutes
  averageBGI: number;
  hadPriorLow: boolean;
  priorLowTime: Date | null;
  priorLowValue: number | null;
}

interface DawnAnalysis {
  // Overall pattern strength
  allDaysShowingAnyPattern: number;
  daysShowingPatternLow: number;
  daysShowingPatternNoLow: number;

  // Timing analysis
  typicalStartTime: string; // HH:MM format
  typicalDuration: number; // minutes

  // Glucose impact
  averageStartGlucose: number;
  averagePeakGlucose: number;
  averageRise: number;

  // Day by day details
  dailyPatterns: DawnPatternDay[];
}

interface TimeCluster {
  centerTime: number; // Minutes since midnight
  times: number[]; // All times in this cluster
  count: number; // How many times in cluster
  startTimeRange: {
    // Human readable range
    earliest: string;
    latest: string;
  };
  daysOfWeek: number[]; // Which days show this pattern (0-6)
}

// Helper to format minutes as time string
const formatMinutes = (mins: number): string => {
  const hours = Math.floor(mins / 60);
  const minutes = Math.round(mins % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

function clusterStartTimes(dates: Date[], windowMinutes: number = 30): TimeCluster[] {
  // Convert dates to minutes since midnight and sort
  const minutesSinceMidnight = dates.map((date) => date.getHours() * 60 + date.getMinutes()).sort((a, b) => a - b);

  const clusters: TimeCluster[] = [];
  let currentCluster: number[] = [minutesSinceMidnight[0]];
  let clusterCenter = minutesSinceMidnight[0];

  // Cluster times based on center
  for (let i = 1; i < minutesSinceMidnight.length; i++) {
    const time = minutesSinceMidnight[i];
    if (Math.abs(time - clusterCenter) <= windowMinutes) {
      currentCluster.push(time);
      // Recalculate center as average
      clusterCenter = currentCluster.reduce((a, b) => a + b) / currentCluster.length;
    } else {
      // Add current cluster with metadata
      clusters.push(createClusterMetadata(currentCluster, dates));
      // Start new cluster
      currentCluster = [time];
      clusterCenter = time;
    }
  }

  // Add final cluster
  clusters.push(createClusterMetadata(currentCluster, dates));

  return clusters;
}

function createClusterMetadata(timeCluster: number[], originalDates: Date[]): TimeCluster {
  // Calculate center
  const centerTime = timeCluster.reduce((a, b) => a + b) / timeCluster.length;

  // Find matching original dates for this cluster
  const clusterDates = originalDates.filter((date) => {
    const minutes = date.getHours() * 60 + date.getMinutes();
    return timeCluster.includes(minutes);
  });

  // Get days of week for this pattern
  const daysOfWeek = [...new Set(clusterDates.map((d) => d.getDay()))];

  return {
    centerTime,
    times: timeCluster,
    count: timeCluster.length,
    startTimeRange: {
      earliest: formatMinutes(Math.min(...timeCluster)),
      latest: formatMinutes(Math.max(...timeCluster)),
    },
    daysOfWeek,
  };
}

function checkDawnPhenomenon(data: AutotunePreppedData, patient_range: PatientRange): DawnAnalysis {
  // Initialize our analysis result
  const analysis: DawnAnalysis = {
    allDaysShowingAnyPattern: 0,
    typicalStartTime: '',
    typicalDuration: 0,
    averageStartGlucose: 0,
    averagePeakGlucose: 0,
    averageRise: 0,
    dailyPatterns: [],
    daysShowingPatternLow: 0,
    daysShowingPatternNoLow: 0,
  };

  // Group basal glucose data by day
  const dailyData = new Map<string, ATReading[]>();

  // Only look at readings between 2 AM and 8 AM
  data.basalGlucoseData.forEach((reading: ATReading) => {
    const readingTime = new Date(reading.date);
    const hour = readingTime.getHours();

    if (hour >= 1 && hour < 8) {
      const dateKey = readingTime.toISOString().split('T')[0];
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, []);
      }
      dailyData.get(dateKey)?.push(reading);
    }
  });

  // Check each day for dawn phenomenon pattern
  dailyData.forEach((readings: ATReading[], dateKey) => {
    // Sort readings by time
    readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Look for sustained rise pattern
    let riseStart: ATReading[0] | null = null;
    let riseEnd: ATReading[0] | null = null;
    let peakReading = readings[0];
    let consecutiveRise = 0;

    // Check if we have any meal activity during this time
    const hasMealActivity = data.CSFGlucoseData.some((meal: ATReading) => {
      const mealTime = new Date(meal.date);
      const mealHour = mealTime.getHours();
      const mealDate = mealTime.toISOString().split('T')[0];
      return mealDate === dateKey && mealHour >= 2 && mealHour < 8;
    });

    // Only look at ranges that don't have meal activity
    if (!hasMealActivity) {
      // Look for pattern of rising glucose with positive deviations
      for (let i = 1; i < readings.length; i++) {
        const reading = readings[i];

        // Look for positive deviations and rising glucose
        if (reading.deviation > 0 && reading.avgDelta > 0) {
          if (!riseStart) {
            riseStart = readings[i - 1];
          }
          consecutiveRise++;

          // Track peak glucose
          if (reading.glucose > peakReading.glucose) {
            peakReading = reading;
          }
        } else {
          // If we've found a significant rise pattern
          if (consecutiveRise >= 3) {
            // At least 15 minutes of rise
            riseEnd = readings[i - 1];
          }
          consecutiveRise = 0;
        }
      }

      // If we found a significant pattern. Significant counts as rising higher
      // then the patient's relative high threshold
      if (riseStart && riseEnd && peakReading.glucose >= patient_range.target_high) {
        // Next, check there wasn't a low blood glucose beforehand
        // Calculate the timestamp 30 minutes before rise start
        const thirtyMinsBefore = new Date(riseStart.date);
        thirtyMinsBefore.setMinutes(thirtyMinsBefore.getMinutes() - 30);

        // Calculate our buffered low threshold
        const bufferedLowThreshold = patient_range.target_low * 1.1;
        // Look for readings below our buffered threshold in the 30-min window
        const priorLowReading = readings.find((reading) => {
          const readingTime = new Date(reading.date);
          return (
            readingTime >= thirtyMinsBefore &&
            readingTime < new Date(riseStart!.date) &&
            reading.glucose <= bufferedLowThreshold
          );
        });

        const patternDay: DawnPatternDay = {
          date: dateKey,
          startTime: new Date(riseStart.date),
          startGlucose: riseStart.glucose,
          peakGlucose: peakReading.glucose,
          timeOfPeak: new Date(peakReading.date),
          averageDeviation: readings.reduce((sum, r) => sum + Number(r.deviation), 0) / readings.length,
          totalDeviation: readings.reduce((sum, r) => sum + Number(r.deviation), 0),
          duration: (new Date(riseEnd.date).getTime() - new Date(riseStart.date).getTime()) / (1000 * 60),
          averageBGI: readings.reduce((sum, r) => sum + Number(r.BGI), 0) / readings.length,
          hadPriorLow: !!priorLowReading,
          priorLowTime: priorLowReading ? new Date(priorLowReading.date) : null,
          priorLowValue: priorLowReading ? priorLowReading.glucose : null,
        };

        analysis.dailyPatterns.push(patternDay);
      }
    }
  });

  analysis.allDaysShowingAnyPattern = analysis.dailyPatterns.length;
  analysis.daysShowingPatternLow = analysis.dailyPatterns.filter((day) => day.hadPriorLow).length;
  let dailyPatternsWithoutPriorLow: DawnPatternDay[] = analysis.dailyPatterns.filter((day) => !day.hadPriorLow);
  analysis.daysShowingPatternNoLow = dailyPatternsWithoutPriorLow.length;

  // Calculate summary statistics over only those without a prior low
  // How many days have a pattern of a rise
  if (dailyPatternsWithoutPriorLow.length > 0) {
    // Calculate typical start time
    const startTimes = dailyPatternsWithoutPriorLow.map((d) => d.startTime.getHours() * 60 + d.startTime.getMinutes());
    const avgStartMinutes = startTimes.reduce((sum, t) => sum + t, 0) / startTimes.length;
    const startHour = Math.floor(avgStartMinutes / 60);
    const startMinute = Math.round(avgStartMinutes % 60);
    analysis.typicalStartTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    // Calculate averages
    analysis.typicalDuration =
      dailyPatternsWithoutPriorLow.reduce((sum, d) => sum + d.duration, 0) / dailyPatternsWithoutPriorLow.length;

    analysis.averageStartGlucose =
      dailyPatternsWithoutPriorLow.reduce((sum, d) => sum + d.startGlucose, 0) / dailyPatternsWithoutPriorLow.length;

    analysis.averagePeakGlucose =
      dailyPatternsWithoutPriorLow.reduce((sum, d) => sum + d.peakGlucose, 0) / dailyPatternsWithoutPriorLow.length;

    analysis.averageRise = analysis.averagePeakGlucose - analysis.averageStartGlucose;

    // Determine pattern strength
    // const patternFrequency = analysis.daysShowingPattern / 7; // Assuming 7 days of data
    // const averageRiseSignificance = analysis.averageRise > 30;
    // const consistentTiming = new Set(startTimes).size < 4; // Less than 4 different start times

    // if (patternFrequency > 0.7 && averageRiseSignificance && consistentTiming) {
    //   analysis.patternStrength = 'strong';
    // } else if (patternFrequency > 0.4 && analysis.averageRise > 20) {
    //   analysis.patternStrength = 'moderate';
    // } else if (analysis.daysShowingPattern > 1) {
    //   analysis.patternStrength = 'weak';
    // }
  }

  return analysis;
}

function analyzeDawnPhenomenonTiming(patterns: DawnPatternDay[]): {
  dawnPhenomClusters: TimeCluster[];
  // isConsistent: boolean;
  // primaryStartTime: string;
  notes: string;
} {
  const startTimes = patterns.map((p) => p.startTime);
  const clusters = clusterStartTimes(startTimes);

  // Determine if timing is consistent
  // const isConsistent = clusters.length === 1 || (clusters.length === 2 && clusters[0].count > patterns.length * 0.7);

  // Find primary start time
  const primaryCluster = clusters.sort((a, b) => b.count - a.count)[0];
  const primaryStartTime = formatMinutes(primaryCluster.centerTime);

  // Generate analysis text
  let notes = '';
  if (clusters.length === 1) {
    notes = `  * Dawn phenomenon consistently starts between ${primaryCluster.startTimeRange.earliest} and ${primaryCluster.startTimeRange.latest}\n`;
  } else {
    notes = `  * Most of the time, dawn phenomenon pattern starts around ${t(primaryStartTime)} (${primaryCluster.count} mornings)\n`;
    clusters.slice(1).forEach((cluster) => {
      if (cluster.count > 1) {
        notes += `  * Sometimes it starts around ${t(formatMinutes(cluster.centerTime))}, with (${cluster.count} mornings)\n`;
      }
    });
  }

  return {
    dawnPhenomClusters: clusters,
    // isConsistent,
    // primaryStartTime,
    notes: notes,
  };
}

export function getDawnPhenomenonNotes(
  dawn_phenom_data: DawnAnalysis,
  notes: string,
  numDays: number,
  preferred_units: GlucoseUnits,
): AssessmentInsight[] {
  var insights: AssessmentInsight[] = [];
  // const allRiseNumDays = dawn_phenom_data.allDaysShowingAnyPattern;
  // const withoutPriorLowDays = dawn_phenom_data.allDaysShowingAnyPattern;
  // -dawn_phenom_data.daysShowingPatternLow;

  // const allRiseFrequency = dawn_phenom_data.allDaysShowingAnyPattern / 7; // Assuming 7 days of data
  // const averageRiseSignificance = dawn_phenom_data.averageRise > 20;

  var note: string = `${dawn_phenom_data.allDaysShowingAnyPattern} of the last 7 days the patient had rising blood glucose from 1 to 8am, which could be a sign of dawn phenomenon. `;

  if (dawn_phenom_data.daysShowingPatternLow > 0) {
    notes += `However, ${dawn_phenom_data.daysShowingPatternLow} of those days, the patient had a low blood glucose in the 30 minutes before the rise happened. Although no meals were detected, it's possible these blood glucose rises were due to the patient waking up and eating something in the middle of the night, but not recording the meal. It's understandable the patient might do this - waking up in the middle of the night to eat something is not desirable, and they probably wanted to get back to sleep as soon as possible!\n\n`;

    if (dawn_phenom_data.daysShowingPatternLow / dawn_phenom_data.allDaysShowingAnyPattern > 0.75) {
    } else {
      notes += `In fact, they experienced lows before the rise more than 50% of the time. So it is likely that this is not dawn phenomenon, but a situation of poor glucose control in the evenings.  `;
    }
    notes += `But they are experiencing lows a quarter of the time, so there is a good chance that the patient is experiencing dawn phenomenon.`;
  }

  insights.push({
    note: note,
    priority: InsightPriority.IMPORTANT,
  });

  let dawnPhenomClusters: TimeCluster[],
    timingNotes = analyzeDawnPhenomenonTiming(dawn_phenom_data.dailyPatterns);

  // const startTimes = dawn_phenom_data.dailyPatterns.map((d) => d.startTime.getHours() * 60 + d.startTime.getMinutes());
  // const consistentTiming = new Set(startTimes).size < 4; // Less than 4 different start times
  if (allRiseFrequency > 0.7 && dawn_phenom_data.averageRise > 30) {
    notes += '  * The patient has strong indication of severe dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.allDaysShowingAnyPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else if (allRiseFrequency > 0.7 && dawn_phenom_data.averageRise > 20) {
    notes += '  * The patient has strong indication of strong dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.allDaysShowingAnyPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else if (allRiseFrequency > 0.5 && dawn_phenom_data.averageRise > 20) {
    notes += '  * There is some indication of dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.allDaysShowingAnyPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else if (allRiseFrequency > 0.2 && dawn_phenom_data.averageRise > 20) {
    notes += '  * The patient may be experiencing dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.allDaysShowingAnyPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else {
    notes += "  * The patient didn't have any indications of dawn phenomenon.\n";
  }
  return notes + '\n';
}

export { checkDawnPhenomenon, type DawnAnalysis, type DawnPatternDay };
