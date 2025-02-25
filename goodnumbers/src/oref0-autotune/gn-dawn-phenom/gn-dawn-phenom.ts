import { ATReading, AutotunePreppedData } from '../gn-autotune-prep';
import { AssessmentInsight, GlucoseUnits, InsightPriority } from '../../types/nightscout';
import { t, u } from '../../utils/text';
import { PatientRange } from '../gn-overview';
import { ATProfileSettings } from '../../components/widgets/nightscoutProfile';
import { analyzeMorningRises, formatMinutes, getUniqueDays } from './gn-dawn-phenom-analysis';
import { MorningRise, MorningRiseAnalysis } from './gn-dawn-phenom-interfaces';

export interface TimeCluster {
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

export function clusterStartTimes(dates: Date[], windowMinutes: number = 30): TimeCluster[] {
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

export function getDawnPhenomenonNotes(
  analysis: MorningRiseAnalysis,
  numDays: number,
  preferred_units: GlucoseUnits,
  patient_range: PatientRange,
): AssessmentInsight[] {
  const insights: AssessmentInsight[] = [];
  const totalRises = analysis.cleanRises.length + analysis.risesAfterLows.length + analysis.risesWithCarbs.length;
  const daysWithData = analysis.daysAnalyzed || numDays;

  // 1 & 2: Check for any rises
  if (totalRises === 0) {
    insights.push({
      note: `No significant early morning blood glucose rises were detected over the ${numDays} days analyzed.`,
      priority: InsightPriority.INFO,
    });
    return insights;
  }

  let summary = `We detected early morning blood glucose rises on ${totalRises} of the ${numDays} days analyzed. Let's examine these rises to understand if they might be related to dawn phenomenon.`;

  insights.push({
    note: summary,
    priority: InsightPriority.INFO,
  });

  // Add note about limited data
  if (numDays <= 7) {
    insights.push({
      note: `Note: This analysis is based on only ${numDays} days of data. Patterns observed may not reflect long-term trends. Consider collecting more data for a more reliable assessment.`,
      priority: InsightPriority.INFO,
    });
  }

  // 3: Account for meal-related rises
  if (analysis.risesWithCarbs.length > 0) {
    insights.push({
      note: `${analysis.risesWithCarbs.length} of these rises were associated with recorded carbohydrate intake. These rises are explained by the impact of carbohydrates, not dawn phenomenon, so we'll set them aside for now.`,
      priority: InsightPriority.INFO,
    });
  }

  // 4: Account for rises after lows
  if (analysis.risesAfterLows.length > 0) {
    let lowsInsight = `${analysis.risesAfterLows.length} rises occurred following low blood glucose events. These rises are likely a response to the low blood glucose rather than dawn phenomenon.`;

    // Factors contributing to nighttime lows
    lowsInsight += ` Factors that commonly contribute to these nighttime lows include:
    • Evening basal insulin doses that may be higher than needed
    • Evening/bedtime bolus insulin that may have been miscalculated
    • Evening physical activity increasing insulin sensitivity for 6-12 hours afterward
    • Delayed gastric emptying from high-fat evening meals leading to insulin-carb timing mismatches
    • Alcohol consumption, which can suppress the liver's ability to release glucose
    • Stress or illness affecting insulin sensitivity`;

    insights.push({
      note: lowsInsight,
      priority: InsightPriority.SERIOUS,
    });
  }

  // 5, 6, & 7: Analyze clean rises
  if (analysis.cleanRises.length > 0) {
    // Use simpler statistics given limited data points
    const riseValues = analysis.cleanRises.map((rise) => rise.endGlucose - rise.startGlucose);
    const durations = analysis.cleanRises.map((rise) => rise.duration);

    // Calculate ranges and medians
    const minRise = Math.min(...riseValues);
    const maxRise = Math.max(...riseValues);
    const medianRise = getMedian(riseValues);

    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const medianDuration = getMedian(durations);

    // Calculate average rise rate (mg/dL per hour)
    const riseRates = analysis.cleanRises.map((rise) => ((rise.endGlucose - rise.startGlucose) / rise.duration) * 60);
    const minRiseRate = Math.min(...riseRates);
    const maxRiseRate = Math.max(...riseRates);

    // Check for rises that cross from below target to above target
    const risesCrossingTargetHigh = analysis.cleanRises.filter(
      (rise) => rise.startGlucose < patient_range.target_high && rise.endGlucose > patient_range.target_high,
    );

    let riseNote = `After accounting for meals and low blood glucose recoveries, we found ${analysis.cleanRises.length} unexplained early morning rises. `;

    // Categorize by time to distinguish dawn vs. feet phenomenon
    const earlyRises = analysis.cleanRises.filter(
      (rise) => rise.startTime.getHours() >= 1 && rise.startTime.getHours() < 3,
    );
    const dawnRises = analysis.cleanRises.filter(
      (rise) => rise.startTime.getHours() >= 3 && rise.startTime.getHours() < 8,
    );

    if (earlyRises.length > 0 && dawnRises.length > 0) {
      riseNote += `${earlyRises.length} rises began between 1-3am (sometimes called "feet phenomenon"), while ${dawnRises.length} rises occurred between 3-8am (classic dawn phenomenon window). `;
    }

    // Use more cautious language with limited data
    if (analysis.cleanRises.length >= 3) {
      riseNote += `This may suggest dawn phenomenon, though more data would strengthen this assessment. `;
    } else {
      riseNote += `With only ${analysis.cleanRises.length} instances observed, more data would be needed to confirm if this represents a consistent pattern. `;
    }

    // Time analysis - simple reporting of when rises occurred
    const startHours = analysis.cleanRises.map((rise) => rise.startTime.getHours());
    const uniqueHours = [...new Set(startHours)].sort((a, b) => a - b);
    const timeRanges = uniqueHours.map((hour) => `${hour}:00-${hour}:59`).join(', ');

    riseNote += `These rises were observed starting in the following hours: ${timeRanges}. `;
    riseNote += `The duration of these rises ranged from ${Math.round(minDuration)} to ${Math.round(maxDuration)} minutes (median: ${Math.round(medianDuration)} minutes). `;

    // Rate of rise assessment
    riseNote += `The rate of rise ranged from ${minRiseRate.toFixed(1)} to ${maxRiseRate.toFixed(1)} per hour. `;

    // Analyze the significance of the rise
    if (medianRise >= 20 || risesCrossingTargetHigh.length > 0) {
      if (risesCrossingTargetHigh.length > 0) {
        riseNote += `On ${risesCrossingTargetHigh.length} of these days, blood glucose rose from below your target range to above ${u(patient_range.target_high, preferred_units)}. `;
      }

      riseNote += `The median rise was ${u(medianRise, preferred_units)}, with a range from ${u(minRise, preferred_units)} to ${u(maxRise, preferred_units)}. `;

      // Factors contributing to dawn phenomenon
      riseNote += `

Physiological factors contributing to dawn phenomenon:
• Increased production of growth hormone, cortisol, and adrenaline during early morning hours
• These counter-regulatory hormones naturally increase insulin resistance
• The liver increases glucose output while muscles and fat become less sensitive to insulin
• For people with type 1 diabetes, there isn't sufficient insulin adaptation to counter these effects
• Peak effect typically occurs between 4-8am but can vary based on sleep patterns

Additional factors that can intensify dawn phenomenon:
• Insufficient basal insulin coverage during overnight hours
• Rebound hyperglycemia from overcorrection of evening lows
• Changes in sleep patterns or poor sleep quality
• Stress and its effect on cortisol levels
• Gastroparesis or delayed digestion of evening meals`;
    } else {
      riseNote += `The median rise was ${u(medianRise, preferred_units)}, with a range from ${u(minRise, preferred_units)} to ${u(maxRise, preferred_units)}. These rises are relatively modest and stayed within target range. Mild early morning rises can be normal physiological responses due to circadian rhythms and hormone fluctuations.`;
    }

    insights.push({
      note: riseNote,
      priority:
        medianRise >= 20 || risesCrossingTargetHigh.length > 0 ? InsightPriority.IMPORTANT : InsightPriority.INFO,
    });
  }

  return insights;
}

// Helper function to calculate median
function getMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
