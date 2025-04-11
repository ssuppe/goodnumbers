import { AssessmentInsight, GlucoseUnits, InsightPriority } from '@/types/nightscout.d';
import { AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
import { u } from '@/utils/text';
import { InsightGenerator } from '../interfaces/insight-generator.interface';

/**
 * Creates a generator for Time in Range (TIR) insights
 * @param compositeday_analysis Analysis result containing glucose data
 * @param preferred_units The user's preferred glucose units (mg/dL or mmol/L)
 * @param num_days Number of days in the analysis period
 * @returns An InsightGenerator for TIR insights
 */
export function createTimeInRangeInsight(
  compositeday_analysis: AnalysisResult, 
  preferred_units: GlucoseUnits,
  num_days: number
): InsightGenerator {
  return {
    getAIInsight(): AssessmentInsight {
      let note = `Medical professionals agree that diabetics should be between ${u(70, preferred_units)} and ${u(180, preferred_units)} 70% of the time. You spent this week in range ${compositeday_analysis.inRangePercentage}% of the time, or about ${Math.round(compositeday_analysis.inRangePercentage / 100 * num_days)} days.`;
      let priority: InsightPriority;

      switch (true) {
        case compositeday_analysis.inRangePercentage <= 50:
          note += `Your blood sugars are spending a significant amount of time outside the target range. This increases your risk of long-term complications, and indicates you need to talk to a medical professional about your insulin regime, diet, and other approaches.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case compositeday_analysis.inRangePercentage > 50 && compositeday_analysis.inRangePercentage <= 60:
          note += `Your Time in Range is OK but not great, but we still have some work to do to reach our goal of over 70%. You are still at risk of long-term complications, and should speak to a medical professional about how to improve your insulin regime, diet and other appraoches `;
          priority = InsightPriority.IMPORTANT;
          break;
        case compositeday_analysis.inRangePercentage > 60 && compositeday_analysis.inRangePercentage <= 70:
          note += `You're getting closer to the target! Your Time in Range is now in the 60-70% range, which is good progress. We're aiming for over 70%, so let's see if we can fine-tune things a bit more.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case compositeday_analysis.inRangePercentage > 70 && compositeday_analysis.inRangePercentage <= 80:
          note += `Congratulations! You've reached our Time in Range goal of over 70%. This is a great accomplishment and shows your hard work is paying off. `;
          priority = InsightPriority.IMPORTANT;
          break;
        case compositeday_analysis.inRangePercentage > 80 && compositeday_analysis.inRangePercentage <= 90:
          note += `Your blood sugar control is excellent! You're spending a very high percentage of time in range. This significantly reduces your risk of long-term complications. `;
          priority = InsightPriority.IMPORTANT;
          break;
        default:
          note += `Your blood sugar control is outstanding! You're spending almost all of your time in range. This is truly remarkable. While this level of control is impressive, we need to be very careful about low blood sugars. Also, you should consider if this is causing you a lot of stress, anxiety or burnout.`;
          priority = InsightPriority.IMPORTANT;
          break;
      }

      return { note, priority };
    },
    
    getUserInsight(): AssessmentInsight {
      // For now, using the same insight for both AI and users
      // This can be customized in the future if needed
      return this.getAIInsight();
    }
  };
}
