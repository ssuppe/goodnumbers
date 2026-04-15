import { Insight, InsightPriority } from '@goodnumbers/types';
import { InsightGenerator } from './interfaces.js';

export class TimeInRangeInsightGenerator implements InsightGenerator {
  constructor(private readonly tirPercentage: number) {}

  generate(): Insight {
    const tir = this.tirPercentage;

    // State 1: High Burden (< 50%)
    if (tir < 50.0) {
      return {
        priority: InsightPriority.IMPORTANT,
        note: `**Focus on the Foundation:** You are spending over half your time outside of target. This can be physically exhausting and lead to "glucose rollercoasters." **Action:** Don't try to fix everything at once. Pick just one area—like your morning routine or one specific recurring meal—to stabilize this week.`,
      };
    }

    // State 2: Building Stability (50% - < 70%)
    if (tir < 70.0) {
      return {
        priority: InsightPriority.IMPORTANT,
        note: `**Making Progress:** You are closing in on the clinical target of 70%. You've built a solid foundation this week. **Action:** Look for "hotspots" in your data. Are there specific times of day where you consistently drift high? Small tweaks to bolus timing could be the key to pushing you over the 70% mark.`,
      };
    }

    // State 3: On Target (70% - 85%)
    if (tir <= 85.0) {
      return {
        priority: InsightPriority.INFO,
        note: `**Goal Reached:** Congratulations! You have hit the international "Gold Standard" target of 70% or more. This level of control significantly supports both your long-term health and your daily energy levels. Great work balancing the many variables of life this week.`,
      };
    }

    // State 4: Mastery (> 85%)
    return {
      priority: InsightPriority.INFO,
      note: `**Outstanding Results:** Your glucose control is exceptional. You are spending the vast majority of your time in a near-ideal range. **A Note on Effort:** This level of precision is truly impressive, but ensure it isn't causing you undue stress or burnout. Diabetes is a marathon—make sure your current pace feels sustainable for your mental health.`,
    };
  }
}

export function createTimeInRangeInsight(
  tirPercentage: number,
): InsightGenerator {
  return new TimeInRangeInsightGenerator(tirPercentage);
}
