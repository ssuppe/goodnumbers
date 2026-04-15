I'd like to to add an AVERAGE insight generator similar to the existing ones. Here's the code from my proof of concept for the AVERAGE insight generator. Any time we give information as an insight, we should give information on what it means, and how to consider it in the real world. The insights should be based on modern healthcare best practices for type 1 diabetes from an endocrinology/medical healthcare professional standpoint, but NOT issue medical advice. If there are things to look at, we should avoid specific instructions, and position as 'talk to your doctor about.'

You don't need to follow this exactly, but here's the code I have so far:

```typescript

import { AssessmentInsight, GlucoseUnits, InsightPriority } from '@/types/nightscout.d';
import { AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
import { GLUCOSE_RANGES } from '../../oref0-autotune/gn-constants';
import { u } from '@/utils/text';
import { InsightGenerator } from '../interfaces/insight-generator.interface';

/**
 * Creates a generator for average glucose insights
 * @param compositeday_analysis Analysis result containing glucose data
 * @param preferred_units The user's preferred glucose units (mg/dL or mmol/L)
 * @returns An InsightGenerator for average glucose insights
 */
export function createAvgGlucoseInsight(
  compositeday_analysis: AnalysisResult,
  preferred_units: GlucoseUnits
): InsightGenerator {
  return {
    getAIInsight(): AssessmentInsight {
      let note: string;
      let priority: InsightPriority;

      if (compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.LOW) {
        note = `* Your average glucose is below normal range, which means you're spending most of your time in hypoglycemia. In fact, you're spending ${compositeday_analysis.lowPercentage}% of the time in hypoglycemia. This can cause seizures, loss of consciousness, cognitive impairment and even death. This requires urgent medical attention. You must speak to your doctor immediately about how to raise your average blood glucose. We cannot go on, we must inform the patient ASAP.`;
        priority = InsightPriority.CRITICAL;
      } else if (
        compositeday_analysis.avgGlucose < GLUCOSE_RANGES.TARGET_BOTTOM &&
        compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW
      ) {
        note = `* Your average glucose is bordering dangerously low, between ${u(GLUCOSE_RANGES.LOW, preferred_units)} and ${u(GLUCOSE_RANGES.TARGET_BOTTOM, preferred_units)}. You may be thinking having a lower blood glucose is keeping you healthy, but you are more likely to have hypoglycemic episodes, which are incredibly dangerous, and can cause seizures, loss of consciousness, cognitive impairment and even death. In fact, you're spending ${compositeday_analysis.lowPercentage}% of the time in hypoglycemia. This requires urgent medical attention. You must speak to your doctor immediately about how to raise your average blood glucose. We cannot go on, we must inform the patient ASAP.`;
        priority = InsightPriority.CRITICAL;
      } else if (
        compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.TARGET_BOTTOM &&
        compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.TARGET_TOP
      ) {
        note = `* Your average glucose is within a non-diabetic range of ${u(GLUCOSE_RANGES.TARGET_BOTTOM, preferred_units)} and ${u(GLUCOSE_RANGES.TARGET_TOP, preferred_units)}. This is a great accomplishment, but may not tell us the full picture. We need to understand how much time you're spending high and low to understand what's happening.\n`;
        priority = InsightPriority.ALWAYS_INCLUDE;
      } else if (
        compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW &&
        compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.TITR_HIGH
      ) {
        note = `* Your average glucose is close to a nearly non-diabetic range, or what we call "in tight range", between ${u(GLUCOSE_RANGES.LOW, preferred_units)} and ${u(GLUCOSE_RANGES.TITR_HIGH, preferred_units)}.\n\nTime in tight range describes the time an individual spends in normal levels of blood glucose.`;
        priority = InsightPriority.ALWAYS_INCLUDE;
      } else if (
        compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW &&
        compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.HIGH
      ) {
        note = `* Your average glucose is within the recommended range below ${u(180, preferred_units)}.\n`;
        priority = InsightPriority.ALWAYS_INCLUDE;
      } else {
        note = 'Your glucose levels suggest your diabetes may need attention. Please schedule a consultation with your healthcare provider to discuss adjusting your management plan.\n';
        priority = InsightPriority.ALWAYS_INCLUDE;
      }

      return { note, priority };
    },

    getUserInsight(): AssessmentInsight {
      // For the current implementation, user insight is the same as AI insight
      // This can be customized in the future if needed
      return this.getAIInsight();
    }
  };
}

First, give me a clinical framework we should use (don't focus on code yet)
```
