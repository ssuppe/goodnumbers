import { describe, it, expect } from 'vitest';
import { generateAggregateInsights } from '@src/lib/insights/aggregate';
import { InsightPriority, GlucoseEntry, GlucoseUnit } from '@goodnumbers/types';

// Helper to create mock entries
const createEntries = (values: number[], count: number = 1): GlucoseEntry[] => {
  const entries: GlucoseEntry[] = [];
  const now = Date.now();
  values.forEach((val) => {
    for (let i = 0; i < count; i++) {
      entries.push({
        sgv: val,
        date: now - i * 300000, // 5 min intervals
        dateString: new Date(now - i * 300000).toISOString(),
        trend: 0,
        direction: 'Flat',
        type: 'sgv',
      });
    }
  });
  return entries;
};

describe('Aggregate Insights (GMI Logic)', () => {
  // GMI Formula: 3.31 + (0.02392 * mean)
  // Target GMI < 7.0 implies Mean < ~154
  // Low GMI < 6.5 implies Mean < ~133
  // High GMI >= 8.0 implies Mean >= ~196

  it('Branch 1: Low GMI (less than 6.5) with High TBR (greater than 4%) -> SERIOUS', () => {
    const entries = [...createEntries([50], 10), ...createEntries([105], 90)];

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.SERIOUS,
        note: expect.stringContaining(
          'Time Below Range is high (greater than 4%)',
        ),
      }),
    );
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.SERIOUS,
        note: expect.stringContaining('false positive'),
      }),
    );
  });

  it('Branch 1: Low GMI (less than 6.5) with Low TBR (<= 4%) -> IMPORTANT', () => {
    const entries = createEntries([100], 100);

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining('exceptionally tight GMI'),
      }),
    );
  });

  it('Branch 2: Target GMI (6.5-6.9) with High TBR -> IMPORTANT', () => {
    const entries = [...createEntries([50], 10), ...createEntries([150], 90)];

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining("cost' was too much time low"),
      }),
    );
  });

  it('Branch 2: Target GMI (6.5-6.9) with Low TBR and Low TIR (less than 70%) -> IMPORTANT', () => {
    const entries = [...createEntries([200], 50), ...createEntries([80], 50)];

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'Time in Range is lower than recommended',
        ),
      }),
    );
  });

  it('Branch 2: Target GMI (6.5-6.9) with Low TBR and High TIR -> IMPORTANT (Gold Standard)', () => {
    const entries = createEntries([140], 100);

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining('Gold Standard'),
      }),
    );
  });

  it('Branch 3: Slightly Elevated GMI (7.0-7.9) with High TBR -> IMPORTANT', () => {
    const entries = [...createEntries([50], 10), ...createEntries([172], 90)];

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining('rollercoaster'),
      }),
    );
  });

  it('Branch 3: Slightly Elevated GMI (7.0-7.9) with Low TBR and High TITR (greater than 40%) -> INFO', () => {
    const entries = [...createEntries([130], 45), ...createEntries([185], 55)];

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.INFO,
        note: expect.stringContaining('Time in Tight Range suggests'),
      }),
    );
  });

  it('Branch 4: Elevated GMI (greater than or equal to 8.0) with High TBR -> SERIOUS', () => {
    const entries = [...createEntries([50], 10), ...createEntries([217], 90)];

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.SERIOUS,
        note: expect.stringContaining('This week looks tough'),
      }),
    );
  });

  it('Branch 4: Elevated GMI (greater than or equal to 8.0) with Low TBR -> SERIOUS', () => {
    const entries = createEntries([200], 100);

    const insights = generateAggregateInsights(entries, GlucoseUnit.MGDL);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.SERIOUS,
        note: expect.stringContaining('consistently above target'),
      }),
    );
  });

  it('Returns empty array if no entries', () => {
    const insights = generateAggregateInsights([], GlucoseUnit.MGDL);
    expect(insights).toEqual([]);
  });
});
