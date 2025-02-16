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
): AssessmentInsight[] {
  const insights: AssessmentInsight[] = [];

  // First summarize what we found
  let summary = `Analysis of the last ${numDays} days shows `;

  if (analysis.cleanRises.length + analysis.risesAfterLows.length + analysis.risesWithCarbs.length === 0) {
    insights.push({
      note: 'No significant early morning blood glucose rises were detected.',
      priority: InsightPriority.INFO,
    });
    return insights;
  }

  // If we found clean rises that could be dawn phenomenon
  if (analysis.cleanRises.length > 0) {
    const avgRise =
      analysis.cleanRises.reduce((sum: number, rise: MorningRise) => sum + (rise.endGlucose - rise.startGlucose), 0) /
      analysis.cleanRises.length;

    summary += `${getUniqueDays(analysis.cleanRises)} mornings with blood glucose rises that could indicate dawn phenomenon. `;
    summary += `These rises typically start around ${analysis
      .startTimeClusters!.map((cluster) => {
        return formatMinutes(cluster.centerTime, true);
      })
      .join(', ')} `;
    summary += `with an average rise of ${u(avgRise, preferred_units)}. `;
    if (analysis.startTimeClusters!.length >= 3) {
      summary += `The fact that the patient's dawn blood glucose rises are spread throughout the morning across ${analysis.startTimeClusters!.length} different times implies this could be more complex. Start with trying to eliminate one at a time.`;
    }

    insights.push({
      note: summary,
      priority: InsightPriority.IMPORTANT,
    });
  }

  // If we found rises after lows
  if (analysis.risesAfterLows.length > 0) {
    insights.push({
      note:
        `On ${analysis.risesAfterLows.length} mornings, the blood glucose rise followed a low blood glucose. ` +
        `These rises might be a response to the low rather than dawn phenomenon.`,
      priority: InsightPriority.SERIOUS,
    });
  }

  // If we found rises with recorded carbs
  if (analysis.risesWithCarbs.length > 0) {
    insights.push({
      note: `${analysis.risesWithCarbs.length} morning rises were associated with recorded carb intake.`,
      priority: InsightPriority.IMPORTANT,
    });
  }

  // Add recommendations if we found clean rises
  if (analysis.cleanRises.length >= 3) {
    insights.push({
      note: 'The pattern of early morning rises suggests dawn phenomenon. Consider discussing basal insulin adjustments with your healthcare provider.',
      priority: InsightPriority.SERIOUS,
    });
  }

  return insights;
}

// export function getDawnPhenomenonNotes(
//   dawn_phenom_data: DawnAnalysis,
//   notes: string,
//   numDays: number,
//   preferred_units: GlucoseUnits,
// ): AssessmentInsight[] {
//   var insights: AssessmentInsight[] = [];

//   // Count patterns with high confidence
//   const highConfidencePatterns = dawn_phenom_data.dailyPatterns.filter((p) => p.confidence > 0.8).length;
//   const moderateConfidencePatterns = dawn_phenom_data.dailyPatterns.filter(
//     (p) => p.confidence > 0.6 && p.confidence <= 0.8,
//   ).length;

//   let note = `Analysis of the past ${numDays} days shows `;

//   if (dawn_phenom_data.allDaysShowingAnyPattern === 0) {
//     note += 'no significant signs of dawn phenomenon.';
//     insights.push({
//       note,
//       priority: InsightPriority.INFO,
//     });
//     return insights;
//   }

//   // Analyze consistency of timing
//   const timingAnalysis = analyzeDawnPhenomenonTiming(dawn_phenom_data.dailyPatterns);

//   // Calculate how many patterns showed meal overlap
//   const patternsWithMeals = dawn_phenom_data.dailyPatterns.filter((p) => p.mealsPresent).length;

//   note += `${highConfidencePatterns} days with strong evidence and ${moderateConfidencePatterns} days with moderate evidence of dawn phenomenon. `;

//   if (highConfidencePatterns + moderateConfidencePatterns >= 3) {
//     note += `The typical pattern shows a glucose rise of ${u(dawn_phenom_data.averageRise, preferred_units)} `;
//     note += `starting around ${t(dawn_phenom_data.typicalStartTime)}. `;

//     if (patternsWithMeals > 0) {
//       note += `${patternsWithMeals} of these days included early morning meals or snacks, but the pattern was still detectable through meal times. `;
//     }

//     note += timingAnalysis.notes;

//     insights.push({
//       note,
//       priority: InsightPriority.IMPORTANT,
//     });

//     // Add specific recommendations if we have strong evidence
//     if (highConfidencePatterns >= 3) {
//       insights.push({
//         note: 'Consider adjusting basal insulin rates during the early morning hours to account for dawn phenomenon. Consultation with your healthcare provider is recommended to discuss these patterns and potential treatment adjustments.',
//         priority: InsightPriority.IMPORTANT,
//       });
//     }
//   } else {
//     note +=
//       'While some rises in blood glucose were detected, the evidence for dawn phenomenon is not conclusive. Continue monitoring for more consistent patterns.';
//     insights.push({
//       note,
//       priority: InsightPriority.IMPORTANT,
//     });
//   }

//   return insights;
// }
