import { describe, it, expect } from 'vitest';
import { calculatePatternStats } from '../../../src/lib/analysis/patterns.js';
import { GlucoseEntry } from '@goodnumbers/types';
import { DateTime } from 'luxon';

describe('calculatePatternStats', () => {
  const timezone = 'America/New_York';

  const makeEntry = (isoTime: string, sgv: number): GlucoseEntry => {
    const date = DateTime.fromISO(isoTime, { zone: timezone }).toMillis();
    return {
      date,
      sgv,
      dateString: isoTime,
    };
  };

  it('handles empty entries list', () => {
    const res = calculatePatternStats([], timezone);
    expect(res).toEqual({
      mostFrequentHigh: null,
      mostFrequentLow: null,
      largestVarianceBlock: null,
    });
  });

  it('correctly detects most frequent high, low, and largest variance block', () => {
    const entries: GlucoseEntry[] = [
      // Morning (7 AM - 11 AM) - Lows
      makeEntry('2026-06-17T08:00:00', 65),
      makeEntry('2026-06-17T09:00:00', 68),
      makeEntry('2026-06-17T10:00:00', 95),

      // Evening (5 PM - 11 PM) - Highs
      makeEntry('2026-06-17T18:00:00', 210),
      makeEntry('2026-06-17T19:00:00', 220),
      makeEntry('2026-06-17T20:00:00', 185),

      // Overnight (11 PM - 7 AM) - Large Variance
      makeEntry('2026-06-17T01:00:00', 80),
      makeEntry('2026-06-17T03:00:00', 170),
      makeEntry('2026-06-17T05:00:00', 90),
    ];

    const stats = calculatePatternStats(entries, timezone);

    // Most highs in Evening (3 highs)
    expect(stats.mostFrequentHigh).toBe('Evening (5:00 PM - 11:00 PM)');

    // Most lows in Morning (2 lows)
    expect(stats.mostFrequentLow).toBe('Morning (7:00 AM - 11:00 AM)');

    // Overnight has std dev of ~49.3, evening is ~18.0, morning is ~16.6. Overnight should have largest variance.
    expect(stats.largestVarianceBlock).toBe('Overnight (11:00 PM - 7:00 AM)');
  });
});
