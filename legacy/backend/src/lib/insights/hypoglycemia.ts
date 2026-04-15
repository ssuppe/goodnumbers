import { Insight, InsightPriority } from '@goodnumbers/types';
import { InsightGenerator } from './interfaces.js';

export class HypoglycemiaInsightGenerator implements InsightGenerator {
  constructor(private readonly tbrPercentage: number) {}

  generate(): Insight {
    const tbr = this.tbrPercentage;

    // State 1: Optimal (< 1%)
    if (tbr < 1.0) {
      return {
        priority: InsightPriority.INFO,
        note: `**Celebrate the Win:** You have achieved near-total avoidance of lows. Maintaining tight control with this high a safety margin is the "Gold Standard." It suggests highly accurate basal rates and carb ratios.`,
      };
    }

    // State 2: Target (1% - 4%)
    // Note: Spec says 1% - 4%. "Target" usually implies inclusive of upper bound for safety, or exclusive?
    // Let's look at the next tier: "Elevated" is > 4%. So Target is <= 4%.
    if (tbr <= 4.0) {
      return {
        priority: InsightPriority.IMPORTANT,
        note: `**Stay the Course:** You are within the international clinical target (less than 4%). This indicates your current management strategy is effectively balancing glucose levels without excessive risk.`,
      };
    }

    // State 3: Elevated (> 4% - < 10%)
    if (tbr < 10.0) {
      return {
        priority: InsightPriority.SERIOUS,
        note: `**Prioritize Safety:** You are exceeding the safe threshold. This level of hypoglycemia often leads to "hypo unawareness" (losing the ability to feel symptoms). **Action:** Focus on reducing lows before trying to lower your average further. Look for "rebound highs" caused by over-treating these events.`,
      };
    }

    // State 4: Critical (>= 10%)
    return {
      priority: InsightPriority.CRITICAL,
      note: `**Medical Urgent:** Spending 10% or more of your time low is a severe threat to your safety and can lead to life-threatening events. Your body's counter-regulatory responses are likely suppressed. **Action:** Please contact your medical team immediately to adjust your therapy. Stop all aggressive "correction" boluses until stability is restored.`,
    };
  }
}

export function createHypoglycemiaInsight(
  tbrPercentage: number,
): InsightGenerator {
  return new HypoglycemiaInsightGenerator(tbrPercentage);
}
