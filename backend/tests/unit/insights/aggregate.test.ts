import { describe, it, expect } from 'vitest';
import { generateAggregateInsights } from '@src/lib/insights/aggregate';
import { InsightPriority } from '@goodnumbers/types';

describe('Aggregate Insights', () => {
  it('generates CRITICAL warning for low average glucose (<70)', () => {
    const entries = Array(10).fill({ sgv: 50, date: Date.now() });
    const insights = generateAggregateInsights(entries);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.CRITICAL,
        note: expect.stringContaining('hypoglycemia'),
      }),
    );
  });

  it('calculates GMI correctly (Mean 150 -> ~6.9%)', () => {
    const entries = Array(10).fill({ sgv: 150, date: Date.now() });
    const insights = generateAggregateInsights(entries);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.INFO,
        note: expect.stringContaining('6.9%'),
      }),
    );
  });
});
