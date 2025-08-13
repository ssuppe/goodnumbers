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
 * Creates a generator for GMI (Glucose Management Indicator) insights
 * @param compositeday_analysis Analysis result containing glucose data
 * @returns An InsightGenerator for GMI insights
 */
export function createGMIInsight(compositeday_analysis: AnalysisResult): InsightGenerator {
  // Calculate GMI once and reuse it
  const gmi = calculateGMI(compositeday_analysis.avgGlucose);
  
  return {
    getAIInsight(): AssessmentInsight {
      let note = `* The patient's estimated Glucose Management Indicator (GMI) based on this week's data is ${gmi.toFixed(1)}%. Note that GMI is typically calculated using 2-3 weeks of data, so this value should be considered an approximation based on limited data and not used for definitive clinical decisions. `;
      let priority: InsightPriority;

      switch (true) {
        case gmi < 6.5:
          note += `This GMI is within the target range recommended by the American Diabetes Association for most adults with type 1 diabetes (less than 7.0%). However, it's important to assess this alongside Time in Range and time spent in hypoglycemia to ensure the patient isn't experiencing frequent lows to achieve this number.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case gmi >= 6.5 && gmi < 7.0:
          note += `This GMI is within the target range recommended by the American Diabetes Association for most adults with type 1 diabetes (less than 7.0%). This indicates relatively good glycemic control.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case gmi >= 7.0 && gmi < 8.0:
          note += `This GMI is slightly above the general target of less than 7.0% recommended by the American Diabetes Association for most adults with type 1 diabetes. Consider adjustments to improve overall glycemic control, while being mindful of hypoglycemia risk.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case gmi >= 8.0 && gmi < 9.0:
          note += `This GMI is significantly above the general target range. The patient may have a higher risk of long-term complications. A comprehensive review of the diabetes management plan is recommended.`;
          priority = InsightPriority.SERIOUS;
          break;
        default: // >= 9.0
          note += `This GMI is well above target range and indicates poor glycemic control. The patient is at significant risk for diabetes-related complications. An urgent review of the diabetes management approach is strongly recommended.`;
          priority = InsightPriority.SERIOUS;
          break;
      }

      return { note, priority };
    },
    
    getUserInsight(): AssessmentInsight {
      let note = `Your estimated Glucose Management Indicator (GMI) based on this week's data is ${gmi.toFixed(1)}%. GMI is similar to an A1C test but calculated from your CGM data. While GMI typically uses 2-3 weeks of data, this estimate is based only on your past week, so it should be viewed as a general indicator rather than a substitute for lab-measured A1C. `;
      let priority: InsightPriority;

      switch (true) {
        case gmi < 6.5:
          note += `This is below the general target of 7.0% for adults with type 1 diabetes, which is excellent. However, we should also look at your Time in Range and time spent low to make sure you're not having too many low blood sugars to achieve this number.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case gmi >= 6.5 && gmi < 7.0:
          note += `This is within the generally recommended target of less than 7.0% for adults with type 1 diabetes. Great job maintaining this level of control!`;
          priority = InsightPriority.IMPORTANT;
          break;
        case gmi >= 7.0 && gmi < 8.0:
          note += `This is a bit above the general target of less than 7.0%. Small adjustments to your diabetes management plan may help bring this down, while still being careful to avoid low blood sugars.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case gmi >= 8.0 && gmi < 9.0:
          note += `This is above the recommended target range. Higher GMI values are associated with an increased risk of long-term diabetes complications. Let's work together with your healthcare provider to identify strategies to improve your blood sugar control.`;
          priority = InsightPriority.SERIOUS;
          break;
        default: // >= 9.0
          note += `This is well above the recommended target range. It's important to work closely with your healthcare provider to make adjustments to your diabetes management plan to help lower your average blood sugars and reduce your risk of complications.`;
          priority = InsightPriority.SERIOUS;
          break;
      }

      return { note, priority };
    }
  };
}
