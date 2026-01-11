import { Insight, InsightPriority, GlucoseEntry } from '@goodnumbers/types';

export function generateAggregateInsights(entries: GlucoseEntry[]): Insight[] {
  if (!entries.length) return [];
  const insights: Insight[] = [];

  const sum = entries.reduce((acc, e) => acc + e.sgv, 0);
  const avg = sum / entries.length;

  // GMI Logic: 3.31 + (0.02392 * mean)
  const gmi = 3.31 + 0.02392 * avg;

  // Secondary metrics
  const tbrCount = entries.filter((e) => e.sgv < 70).length;
  const tbr = tbrCount / entries.length;

  const tirCount = entries.filter((e) => e.sgv >= 70 && e.sgv <= 180).length;
  const tir = tirCount / entries.length;

  const titrCount = entries.filter((e) => e.sgv >= 70 && e.sgv <= 140).length;
  const titr = titrCount / entries.length;

  const TBR_LIMIT = 0.04; // 4%
  const TIR_TARGET = 0.7; // 70%
  const TITR_ADVANCED_GOAL = 0.4; // 40% (as per spec)

  // Note preamble
  let note = `Your estimated GMI for this week is ${gmi.toFixed(1)}%. `;
  let priority = InsightPriority.IMPORTANT;

  // BRANCH 1: LOW GMI (less than 6.5)
  if (gmi < 6.5) {
    if (tbr > TBR_LIMIT) {
      note +=
        "While this is a 'tight' number, your Time Below Range is high (greater than 4%). This suggests the low average is being driven by too many lows. This is a 'false positive' for tight control. Prioritizing safety and reducing hypos is recommended, even if your GMI rises slightly.";
      priority = InsightPriority.SERIOUS;
    } else {
      note +=
        'This is an exceptionally tight GMI (less than 6.5%) with safe amounts of low blood sugar. You are effectively managing your diabetes at a level often seen in people without diabetes. Reflection: How much mental effort did this take? Ensure this level of management feels sustainable for you.';
      priority = InsightPriority.IMPORTANT;
    }
  }

  // BRANCH 2: TARGET GMI (6.5 - 6.9)
  else if (gmi < 7.0) {
    if (tbr > TBR_LIMIT) {
      note +=
        "You hit the GMI target (less than 7.0%), but your Time Below Range is elevated. While the average looks good, the 'cost' was too much time low. Try to trim the lows next week; a slightly higher average with fewer lows is clinically preferred.";
      priority = InsightPriority.IMPORTANT;
    } else if (tir < TIR_TARGET) {
      note +=
        "Your GMI is on target, but your Time in Range is lower than recommended (less than 70%). This usually means you had swings between highs and lows that averaged out to a 'good' number. Goal: Focus on flattening the roller coaster rather than just lowering the average.";
      priority = InsightPriority.IMPORTANT;
    } else {
      note +=
        "This is the clinical 'Gold Standard': A GMI on target with high Time in Range and safe low levels. You balanced your glucose beautifully this week.";
      priority = InsightPriority.IMPORTANT;
    }
  }

  // BRANCH 3: SLIGHTLY ELEVATED (7.0 - 7.9)
  else if (gmi < 8.0) {
    if (tbr > TBR_LIMIT) {
      note +=
        "Your GMI is slightly elevated, and you also had significant time low. This indicates a 'rollercoaster' week where highs and lows are both present. Tip: Fix the lows first. Often, rebound highs (over-treating lows) are what keep the average up.";
      priority = InsightPriority.IMPORTANT;
    } else if (titr > TITR_ADVANCED_GOAL) {
      note +=
        'You are very close to the target. Your Time in Tight Range suggests you are hitting the mark often, but perhaps dealing with stubborn highs after meals or overnight. Small adjustments to timing could be effective here.';
      priority = InsightPriority.INFO;
    } else {
      note +=
        'Your GMI is slightly above target. Since your lows are safe, the focus shifts to the highs. Look for patterns: are there specific times of day (like post-breakfast) pulling your average up?';
      priority = InsightPriority.INFO;
    }
  }

  // BRANCH 4: ELEVATED (greater than or equal to 8.0)
  else {
    priority = InsightPriority.SERIOUS;
    if (tbr > TBR_LIMIT) {
      note +=
        "This week looks tough. You are seeing both significant highs and lows. This creates a high physical and mental burden. Suggestion: Don't worry about the highs yet. Focus 100% on stopping the lows/hypos for a few days to stabilize the vessel.";
    } else {
      note +=
        "Your average this week was consistently above target range. The good news is you aren't battling lows, which provides a safe foundation to be more aggressive. It may be time to review your basal rates or carb ratios with your care team.";
    }
  }

  insights.push({ note, priority });

  return insights;
}
