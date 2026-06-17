import { describe, it, expect } from 'vitest';
import { calculateMetrics, calculateTrends } from '../../src/lib/scorecard';
import { GlucoseEntry } from '@goodnumbers/types';

describe('Scorecard Logic', () => {
  describe('calculateMetrics', () => {
    it('should return zeros for empty data', () => {
      const result = calculateMetrics([]);
      expect(result).toEqual({
        avgGlucose: 0,
        stability: 0,
        timeInRange: 0,
        timeInTightRange: 0,
        timeBelowRange: 0,
      });
    });

    it('should handle division by zero/NaN gracefully', () => {
      // Mock data that might cause issues if not handled
      const entries = [
        { sgv: NaN, date: Date.now() },
      ] as unknown as GlucoseEntry[];
      const result = calculateMetrics(entries);
      expect(result.avgGlucose).toBe(0); // Should be 0, not NaN
    });

    it('should calculate stability correctly (CV / Coefficient of Variation)', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z').getTime();
      const entries: GlucoseEntry[] = [
        {
          sgv: 100,
          date: baseTime,
          dateString: new Date(baseTime).toISOString(),
        },
        {
          sgv: 105,
          date: baseTime + 5 * 60 * 1000,
          dateString: new Date(baseTime + 5 * 60 * 1000).toISOString(),
        },
        {
          sgv: 120,
          date: baseTime + 10 * 60 * 1000,
          dateString: new Date(baseTime + 10 * 60 * 1000).toISOString(),
        },
      ];
      // Mean: 108.33, stdDev: 8.50, CV: 7.84% (rounded to 8)
      const result = calculateMetrics(entries);
      expect(result.stability).toBe(8);
    });

    it('should calculate averages and ranges correctly', () => {
      const entries: GlucoseEntry[] = [
        { sgv: 100, date: 1, dateString: '' }, // In range, In tight
        { sgv: 150, date: 2, dateString: '' }, // In range, Out tight
        { sgv: 200, date: 3, dateString: '' }, // Out range (high)
        { sgv: 50, date: 4, dateString: '' }, // Out range (low)
      ];
      // Avg: 500 / 4 = 125
      // TIR: 2/4 = 50%
      // TITR: 1/4 = 25%
      // TBR: 1/4 = 25%
      const result = calculateMetrics(entries);
      expect(result.avgGlucose).toBe(125);
      expect(result.timeInRange).toBe(50);
      expect(result.timeInTightRange).toBe(25);
      expect(result.timeBelowRange).toBe(25);
    });
  });

  describe('calculateTrends', () => {
    const current = {
      avgGlucose: 140,
      stability: 60,
      timeInRange: 80,
      timeInTightRange: 50,
      timeBelowRange: 10,
    };
    const prev = {
      avgGlucose: 150,
      stability: 50,
      timeInRange: 70,
      timeInTightRange: 40,
      timeBelowRange: 5,
    };

    it('should return signed deltas', () => {
      const trends = calculateTrends(current, prev);
      expect(trends?.avgGlucose).toBe(-10); // 140 - 150
      expect(trends?.stability).toBe(10); // 60 - 50
      expect(trends?.timeBelowRange).toBe(5); // 10 - 5
    });

    it('should return null if previous data is missing', () => {
      expect(calculateTrends(current, null)).toBeNull();
    });
  });
});
