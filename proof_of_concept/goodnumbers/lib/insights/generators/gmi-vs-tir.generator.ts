import { AssessmentInsight, InsightPriority } from '@/types/nightscout.d';
import { AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
import { InsightGenerator } from '../interfaces/insight-generator.interface';

/**
 * Calculate the Glucose Management Indicator (GMI) based on average glucose.
 * Formula: 3.31 + (0.02392 × mean glucose in mg/dL)
 * @param avgGlucose Average glucose in mg/dL
 * @returns GMI value as a percentage
 */
function calculateGMI(avgGlucose: number): number {
  return 3.31 + 0.02392 * avgGlucose;
}

/**
 * Creates a generator for insights that correlate GMI with Time in Range
 * @param compositeday_analysis Analysis result containing glucose data
 * @returns An InsightGenerator for GMI vs Time in Range correlation insights
 */
export function createGMIvsTimeInRangeInsight(compositeday_analysis: AnalysisResult): InsightGenerator {
  // Calculate values once and reuse
  const gmi = calculateGMI(compositeday_analysis.avgGlucose);
  const timeInRange = compositeday_analysis.inRangePercentage;
  
  return {
    getAIInsight(): AssessmentInsight {
      let note = '';
      let priority: InsightPriority;

      if (gmi < 7.0 && timeInRange < 70) {
        note = `* The patient's GMI (${gmi.toFixed(1)}%) suggests good control, but the Time in Range (${timeInRange}%) is below target. This combination may indicate glycemic variability or frequent hypoglycemia compensating for hyperglycemia. It's important to investigate patterns of highs and lows rather than focusing solely on average values.`;
        priority = InsightPriority.SERIOUS;
      } else if (gmi >= 7.0 && timeInRange >= 70) {
        note = `* The patient's GMI (${gmi.toFixed(1)}%) is above target, yet Time in Range (${timeInRange}%) is good. This suggests periods of significant hyperglycemia without corresponding lows that may be elevating the overall average without drastically reducing Time in Range.`;
        priority = InsightPriority.IMPORTANT;
      } else if (gmi < 7.0 && timeInRange >= 70) {
        note = `* The patient shows excellent glycemic control with a GMI of ${gmi.toFixed(1)}% and Time in Range of ${timeInRange}%. This combination suggests stable glucose values with minimal extreme highs or lows.`;
        priority = InsightPriority.IMPORTANT;
      } else {
        note = `* Both the patient's GMI (${gmi.toFixed(1)}%) and Time in Range (${timeInRange}%) indicate opportunities for improved glycemic control. This likely represents significant periods of hyperglycemia that should be addressed to reduce long-term complication risk.`;
        priority = InsightPriority.SERIOUS;
      }

      return { note, priority };
    },
    
    getUserInsight(): AssessmentInsight {
      let note = '';
      let priority: InsightPriority;

      if (gmi < 7.0 && timeInRange < 70) {
        note = `Your GMI looks good at ${gmi.toFixed(1)}%, but your Time in Range is lower than target at ${timeInRange}%. This could mean you're having some very high and some very low readings that are averaging out to a good GMI number. Reducing these swings would be beneficial for your overall diabetes management.`;
        priority = InsightPriority.SERIOUS;
      } else if (gmi >= 7.0 && timeInRange >= 70) {
        note = `Your Time in Range looks good at ${timeInRange}%, but your GMI is higher than target at ${gmi.toFixed(1)}%. This might mean you're having some periods of very high blood sugar that are affecting your overall average. Focusing on reducing these high periods could help improve your long-term outcomes.`;
        priority = InsightPriority.IMPORTANT;
      } else if (gmi < 7.0 && timeInRange >= 70) {
        note = `Great job! Both your GMI (${gmi.toFixed(1)}%) and Time in Range (${timeInRange}%) are meeting targets, indicating good overall diabetes management with stable glucose levels.`;
        priority = InsightPriority.IMPORTANT;
      } else {
        note = `Both your GMI (${gmi.toFixed(1)}%) and Time in Range (${timeInRange}%) suggest there's room to improve your blood sugar management. Working with your healthcare provider to adjust your treatment plan could help bring these numbers closer to target ranges.`;
        priority = InsightPriority.SERIOUS;
      }

      return { note, priority };
    }
  };
}
