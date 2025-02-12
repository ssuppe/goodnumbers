import { AutotunePreppedData } from 'gn-autotune-prep';
import { GlucoseUnits } from '../types/nightscout';
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
  daysShowingPattern: number;
  daysShowingPatternWithPriorLow: number;

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
    daysShowingPattern: 0,
    typicalStartTime: '',
    typicalDuration: 0,
    averageStartGlucose: 0,
    averagePeakGlucose: 0,
    averageRise: 0,
    dailyPatterns: [],
  };

  // Group basal glucose data by day
  const dailyData = new Map<string, Array<(typeof data.basalGlucoseData)[0]>>();

  // Only look at readings between 2 AM and 8 AM
  data.basalGlucoseData.forEach((reading) => {
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
  dailyData.forEach((readings, dateKey) => {
    // Sort readings by time
    readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Look for sustained rise pattern
    let riseStart: (typeof readings)[0] | null = null;
    let riseEnd: (typeof readings)[0] | null = null;
    let peakReading = readings[0];
    let consecutiveRise = 0;

    // Check if we have any meal activity during this time
    const hasMealActivity = data.CSFGlucoseData.some((meal) => {
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

  analysis.daysShowingPattern = analysis.dailyPatterns.length;
  analysis.daysShowingPatternWithPriorLow = analysis.dailyPatterns.filter((day) => day.hadPriorLow).length;

  let dailyPatternsWithoutPriorLow: DawnPatternDay[] = analysis.dailyPatterns.filter((day) => !day.hadPriorLow);

  // Calculate summary statistics
  // How many days have a pattern of a rise
  // Of those, how many had a low prior?
  if (dailyPatternsWithoutPriorLow.length > 0) {
    // Calculate typical start time
    const startTimes = analysis.dailyPatterns.map((d) => d.startTime.getHours() * 60 + d.startTime.getMinutes());
    const avgStartMinutes = startTimes.reduce((sum, t) => sum + t, 0) / startTimes.length;
    const startHour = Math.floor(avgStartMinutes / 60);
    const startMinute = Math.round(avgStartMinutes % 60);
    analysis.typicalStartTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    // Calculate averages
    analysis.typicalDuration =
      analysis.dailyPatterns.reduce((sum, d) => sum + d.duration, 0) / analysis.dailyPatterns.length;

    analysis.averageStartGlucose =
      analysis.dailyPatterns.reduce((sum, d) => sum + d.startGlucose, 0) / analysis.dailyPatterns.length;

    analysis.averagePeakGlucose =
      analysis.dailyPatterns.reduce((sum, d) => sum + d.peakGlucose, 0) / analysis.dailyPatterns.length;

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
) {
  const patternFrequency = dawn_phenom_data.daysShowingPattern / 7; // Assuming 7 days of data
  const averageRiseSignificance = dawn_phenom_data.averageRise > 20;
  let dawnPhenomClusters: TimeCluster[],
    timingNotes = analyzeDawnPhenomenonTiming(dawn_phenom_data.dailyPatterns);

  // const startTimes = dawn_phenom_data.dailyPatterns.map((d) => d.startTime.getHours() * 60 + d.startTime.getMinutes());
  // const consistentTiming = new Set(startTimes).size < 4; // Less than 4 different start times
  var notes = '';
  if (patternFrequency > 0.7 && dawn_phenom_data.averageRise > 30) {
    notes += '  * The patient has strong indication of severe dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.daysShowingPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else if (patternFrequency > 0.7 && dawn_phenom_data.averageRise > 20) {
    notes += '  * The patient has strong indication of strong dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.daysShowingPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else if (patternFrequency > 0.5 && dawn_phenom_data.averageRise > 20) {
    notes += '  * There is some indication of dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.daysShowingPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else if (patternFrequency > 0.2 && dawn_phenom_data.averageRise > 20) {
    notes += '  * The patient may be experiencing dawn phenomenon.\n';
    notes += `  * In ${dawn_phenom_data.daysShowingPattern} of the last ${numDays} mornings, the patient's blood glucose rose on average ${u(dawn_phenom_data.averageRise, preferred_units)}\n`;
    notes += timingNotes.notes;
  } else {
    notes += "  * The patient didn't have any indications of dawn phenomenon.\n";
  }
  return notes + '\n';
}

export { checkDawnPhenomenon, type DawnAnalysis, type DawnPatternDay };
