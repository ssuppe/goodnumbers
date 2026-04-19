import { Insight, InsightPriority, GlycemicCluster } from '@goodnumbers/types';

interface Treatment {
  date: number;
  carbs?: number;
  insulin?: number;
}

const MEAL_LOOKBACK_MS = 180 * 60 * 1000; // 3 hours
const BOLUS_SEARCH_MS = 30 * 60 * 1000; // 30 minutes
const PREBOLUS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function generateClusterInsights(
  cluster: GlycemicCluster,
  treatments: Treatment[],
): Insight[] {
  if (!cluster.events || !cluster.events.length) return [];

  const insights: Insight[] = [];

  if (cluster.type === 'hypo') {
    // TODO: Implement hypo-specific heuristics if needed
    return [];
  }

  let uncoveredCount = 0;
  let postBolusCount = 0;
  let preBolusCount = 0;
  let mealRelatedCount = 0;

  cluster.events.forEach((event) => {
    const eventTime = new Date(event.startTime).getTime();

    // 1. Find all meals in the 3h lookback window
    const relevantMeals = treatments.filter(
      (t) =>
        (t.carbs || 0) > 0 &&
        t.date >= eventTime - MEAL_LOOKBACK_MS &&
        t.date <= eventTime,
    );

    if (relevantMeals.length === 0) return;

    // Categorize this event based on the bolus status of its meals
    let eventUncovered = false;
    let eventPostBolus = false;
    let eventPreBolus = false;

    relevantMeals.forEach((meal) => {
      // Find closest bolus within +/- 30 mins of the meal
      let closestBolus: Treatment | null = null;
      let minDelta = Infinity;

      for (const t of treatments) {
        if ((t.insulin || 0) > 0) {
          const delta = Math.abs(t.date - meal.date);
          if (delta <= BOLUS_SEARCH_MS && delta < minDelta) {
            minDelta = delta;
            closestBolus = t;
          }
        }
      }

      if (!closestBolus) {
        eventUncovered = true;
      } else {
        const bolusVsMealDiff = closestBolus.date - meal.date;
        if (bolusVsMealDiff < -PREBOLUS_THRESHOLD_MS) {
          eventPreBolus = true;
        } else {
          eventPostBolus = true;
        }
      }
    });

    // Priority: Uncovered > Post-bolus > Pre-bolus
    mealRelatedCount++;
    if (eventUncovered) {
      uncoveredCount++;
    } else if (eventPostBolus) {
      postBolusCount++;
    } else if (eventPreBolus) {
      preBolusCount++;
    }
  });

  // Add Summary Insight
  if (mealRelatedCount > 0) {
    const percent = Math.round((mealRelatedCount / cluster.eventCount) * 100);
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `${percent}% of these high events (${mealRelatedCount} out of ${cluster.eventCount}) appear to be meal-related.`,
    });
  }

  if (uncoveredCount > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Potential uncovered meals detected in ${uncoveredCount} events.`,
    });
  }

  if (postBolusCount > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Post-meal hyperglycemia detected in ${postBolusCount} events where insulin was given at or after eating (post-bolused).`,
    });
  }

  if (preBolusCount > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Hyperglycemia occurred in ${preBolusCount} events despite insulin being given before the meal.`,
    });
  }

  return insights;
}
