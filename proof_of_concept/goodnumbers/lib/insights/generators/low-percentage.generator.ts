import { AssessmentInsight, InsightPriority } from '@/types/nightscout.d';
import { AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
import { InsightGenerator } from '../interfaces/insight-generator.interface';

/**
 * Creates a generator for low blood glucose percentage insights
 * @param compositeday_analysis Analysis result containing glucose data
 * @returns An InsightGenerator for low percentage insights
 */
export function createLowPercentageInsight(compositeday_analysis: AnalysisResult): InsightGenerator {
  // Round the percentage once and reuse it
  const lowPercentage = Math.round(compositeday_analysis.lowPercentage);
  
  return {
    getAIInsight(): AssessmentInsight {
      let note = `Medical professionals agree that diabetics should spend less than 4% of the time low. You're spending ${lowPercentage}% of the time low. `;
      let priority: InsightPriority;

      switch (true) {
        case lowPercentage <= 3:
          note += `This is quite good - you're well below the clinical recommendation. Staying in non-diabetic target while keeping your lows down is quite an accomplishment. Keep doing what you're doing.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case lowPercentage <= 4:
          note += `This is quite good - you're below the clinical recommendation of 4%. However, you are pretty close to it. Keep an eye on this and aim to improve it next week. `;
          priority = InsightPriority.IMPORTANT;
          break;
        case lowPercentage < 10:
          note += `This is quite high and this should be one of the first things you try to improve. Spending anywhere near 10% in hypoglycemia is considered significant and requires medical attention. `;
          priority = InsightPriority.SERIOUS;
          break;
        default:
          note += `Your time spent in hypoglycemia, or low blood sugar, is quite high. Clinical best practices say anything higher than 10%  is a severe, critical risk to your health and may require emergency intervention. We cannot continue until you improve this.`;
          priority = InsightPriority.CRITICAL;
          break;
      }
      
      return { note, priority };
    },
    
    getUserInsight(): AssessmentInsight {
      let note = '';
      let priority: InsightPriority;

      switch (true) {
        case lowPercentage <= 3:
          note = `Time spent low (${lowPercentage}%) is well below the recommended threshold of 4%. This indicates good control over hypoglycemia.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case lowPercentage <= 4:
          note = `Time spent low (${lowPercentage}%) is within the recommended threshold of 4%. Continue to monitor for low blood glucose events.`;
          priority = InsightPriority.IMPORTANT;
          break;
        case lowPercentage < 10:
          note = `Time spent low (${lowPercentage}%) is higher than the recommended threshold of 4% or below. Hypoglycemia (low blood sugar) can be dangerous. Strategies to reduce low blood sugar events should be implemented.`;
          priority = InsightPriority.SERIOUS;
          break;
        default:
          note = `Time spent low (${lowPercentage}%) is critically high, much higher than the recommended threshold of 4% or below. Prolonged or frequent hypoglycemia is a serious health risk. Immediate medical attention and adjustments to treatment are necessary.`;
          priority = InsightPriority.CRITICAL;
          break;
      }
      
      return { note, priority };
    }
  };
}
