import { describe, it, expect } from 'vitest';
import { generateAggregateInsights } from '../../../src/lib/insights/aggregate.js';
import { GlucoseUnit } from '@goodnumbers/types';
import { GlucoseEntry } from '@goodnumbers/types';

describe('generateAggregateInsights', () => {
  it('should generate all types of insights', () => {
    // Create mock entries for a "Target" scenario
    // Avg ~120, TIR ~75%, TBR ~2%
    const entries: GlucoseEntry[] = [];
    const date = new Date().toISOString();

    // 75 entries in range (100)
    for (let i = 0; i < 75; i++) {
      entries.push({
        sgv: 100,
        dateString: date,
        date: 0,
        sysTime: date,
        device: 'test',
      });
    }
    // 2 entries below range (60)
    for (let i = 0; i < 2; i++) {
      entries.push({
        sgv: 60,
        dateString: date,
        date: 0,
        sysTime: date,
        device: 'test',
      });
    }
    // 23 entries above range (200)
    for (let i = 0; i < 23; i++) {
      entries.push({
        sgv: 200,
        dateString: date,
        date: 0,
        sysTime: date,
        device: 'test',
      });
    }

    // Total 100 entries.
    // TIR = 75%
    // TBR = 2%

    const insights = generateAggregateInsights(
      entries,
      GlucoseUnit.MGDL,
      'Europe/London',
    );

    // We expect:
    // 1. GMI/Legacy insight (always first)
    // 2. Avg Glucose insight
    // 3. Hypoglycemia insight
    // 4. Time In Range insight

    expect(insights.length).toBeGreaterThanOrEqual(4);

    // Check for GMI insight (legacy logic)
    expect(insights[0].note).toContain('GMI');

    // Check for Hypoglycemia insight (Target: 1-4%)
    const hypoInsight = insights.find((i) =>
      i.note.includes('Stay the Course'),
    );
    expect(hypoInsight).toBeDefined();

    // Check for Time In Range insight (Target: 70-85%)
    const tirInsight = insights.find((i) => i.note.includes('Goal Reached'));
    expect(tirInsight).toBeDefined();

    // Check for Avg Glucose insight
    const avgInsight = insights.find((i) => i.note.includes('average glucose'));
    expect(avgInsight).toBeDefined();
  });

  it('should handle empty entries', () => {
    const insights = generateAggregateInsights([], GlucoseUnit.MGDL, 'UTC');
    expect(insights).toEqual([]);
  });
});
