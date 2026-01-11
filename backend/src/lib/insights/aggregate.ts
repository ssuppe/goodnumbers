import { Insight, InsightPriority, GlucoseEntry } from '@goodnumbers/types';

export function generateAggregateInsights(entries: GlucoseEntry[]): Insight[] {
  if (!entries.length) return [];
  const insights: Insight[] = [];
  const sum = entries.reduce((acc, e) => acc + e.sgv, 0);
  const avg = sum / entries.length;

  // GMI Logic: 3.31 + (0.02392 * mean)
  const gmi = 3.31 + 0.02392 * avg;
  insights.push({
    priority: InsightPriority.INFO,
    note: `Estimated GMI: ${gmi.toFixed(1)}%`,
  });

  // Low Glucose Logic
  if (avg < 70) {
    insights.push({
      priority: InsightPriority.CRITICAL,
      note: 'Average glucose indicates frequent hypoglycemia.',
    });
  }
  return insights;
}
