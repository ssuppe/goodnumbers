import { Insight, InsightPriority, GlycemicCluster } from '@goodnumbers/types';

interface Treatment {
  date: number;
  carbs?: number;
  insulin?: number;
}

export function generateClusterInsights(
  cluster: GlycemicCluster,
  treatments: Treatment[],
): Insight[] {
  if (!cluster.events || !cluster.events.length) return [];

  const insights: Insight[] = [];
  let uncoveredCount = 0;

  // Optimization: Treatments should be pre-sorted by caller, but we filter linearly here
  // assuming N is small after pre-filtering in worker.

  cluster.events.forEach((event) => {
    const eventTime = new Date(event.startTime).getTime();
    const lookback = eventTime - 180 * 60 * 1000; // 3 hours

    // SECURITY: Use Epoch MS for comparison
    const relevant = treatments.filter(
      (t) => t.date >= lookback && t.date <= eventTime,
    );

    const hasCarbs = relevant.some((t) => (t.carbs || 0) > 0);
    const hasInsulin = relevant.some((t) => (t.insulin || 0) > 0);

    if (hasCarbs && !hasInsulin) uncoveredCount++;
  });

  if (uncoveredCount > 0) {
    // SECURITY: Use static string templates, do not inject raw treatment data
    // Also avoid < and > characters
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Potential uncovered meals detected in ${uncoveredCount} events.`,
    });
  }
  return insights;
}
