import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { calculateAgp } from './calculateAgp.js';

// --- New Deterministic Test Data Setup ---

// Data set for P50 test: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
// N = 10. P50 Index = 5.5. P50 = V(5) + 0.5 * (V(6) - V(5)) = 50 + 0.5 * 10 = 55.0
const SMALL_TEST_DATA = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// --- Helper to create Nightscout entries for a specific hour ---
const createTestEntries = (
  values: number[],
  hour: number,
  timezone: string,
) => {
  const entries = [];
  // Use a predictable starting date (Jan 1, 2024) and UTC for the input format
  const baseDate = DateTime.fromISO('2024-01-01T00:00:00', { zone: timezone });

  for (let i = 0; i < values.length; i++) {
    // Spread the points across 7 days, all falling into the target hour in the target timezone
    const timestamp = baseDate.plus({ days: i, hours: hour });

    entries.push({
      // The worker expects a millisecond timestamp (number)
      date: timestamp.toMillis(),
      sgv: values[i], // mg/dL
      type: 'sgv',
    });
  }
  return entries;
};

describe('calculateAgp', () => {
  // This test checks the R-7 math and the Mean calculation using a simple hardcoded set.
  it('should calculate correct R-7 percentiles and mean on a hardcoded, non-sparse array (N=10)', async () => {
    // Generate data for the 10:00 hour. Since N=10 is much less than 59,
    // we must temporarily set the threshold to pass the test, then revert the threshold.
    // However, since this test is only about math, we'll use a data set that has enough points to pass the original threshold.

    // We will create a new synthetic data generator that is simple and deterministic
    // N = 60 points for 10:00 hour (passes 59 threshold)
    const valuesForThresholdPass = Array.from(
      { length: 60 },
      (_, i) => 100 + i,
    ); // [100, 101, ..., 159]
    const testEntries = createTestEntries(
      valuesForThresholdPass,
      10,
      'Europe/London',
    );

    // Recalculate R-7 for N=60:
    // N=60. P50 Index = (60-1)*0.5 + 1 = 30.5. V(30)=129, V(31)=130. Result = 129.50
    // Mean = (100+159)/2 = 129.50
    const expectedMedian = 129.5;
    const expectedMean = 129.5;

    // P5 Index: (60-1)*0.05 + 1 = 3.95. V(3)=102, V(4)=103. Result = 102 + 0.95*(103-102) = 102.95
    const expectedP5 = 102.95;

    // P95 Index: (60-1)*0.95 + 1 = 58.05. V(57)=156, V(58)=157. Result = 156 + 0.05*(157-156) = 156.05
    const expectedP95 = 156.05;

    const result = calculateAgp(testEntries, 'Europe/London');
    const hour10Bin = result.find((b: { time: string }) => b.time === '10:00');
    expect(hour10Bin).toBeDefined();

    // The Mean is currently failing. Let's ensure the library calculates it correctly.
    expect(hour10Bin?.mean).toBeCloseTo(expectedMean, 2);

    // Median Test
    expect(hour10Bin?.median).toBeCloseTo(expectedMedian, 2);

    // Percentile Tests
    expect(hour10Bin?.p5).toBeCloseTo(expectedP5, 2);
    expect(hour10Bin?.p95).toBeCloseTo(expectedP95, 2);
  });

  // This test validates the Timezone Localization bug fix (which is now passing).
  it('should correctly localize time before binning (e.g., check hour boundary shift)', async () => {
    // 1 point at 00:15 UTC is 19:15 EST. It should fall into the 19:00 bin.
    const entries = [
      {
        date: DateTime.fromISO('2024-01-01T00:15:00Z').toMillis(),
        sgv: 150,
        type: 'sgv',
      },
    ];

    const result = calculateAgp(entries, 'America/New_York');

    // Check the 00:00 bin (should be empty)
    expect(result[0].time).toBe('00:00');
    expect(result[0].mean).toBeNull();

    // Check the 19:00 bin (should contain the point)
    expect(result[19].time).toBe('19:00');
    // Mean should be 150 (since it's 1 point, and the threshold only applies to percentiles)
    expect(result[19].mean).toBeCloseTo(150.0, 2);

    // Percentiles must be null because N=1 < 59 threshold
    expect(result[19].median).toBeNull();
  });

  // This test validates the Minimum Data Threshold.
  it('should enforce the Minimum Data Threshold (59 points) by returning nulls for percentiles', async () => {
    // N=56 is below the threshold.
    const sparseValues = Array.from({ length: 56 }, (_, i) => 100 + i);
    const sparseEntries = createTestEntries(sparseValues, 10, 'Europe/London');
    const result = calculateAgp(sparseEntries, 'Europe/London');
    const hour10Bin = result.find((b: { time: string }) => b.time === '10:00');
    expect(hour10Bin).toBeDefined();

    // Should be null because 56 < 59
    expect(hour10Bin?.p5).toBeNull();
    expect(hour10Bin?.median).toBeNull();
    expect(hour10Bin?.p95).toBeNull();

    // Mean should still be calculated if data exists
    expect(hour10Bin?.mean).toBeCloseTo(127.5, 2); // Mean of [100..155] is (100+155)/2 = 127.5
  });

  it('should correctly return 24 hourly bins', async () => {
    const entries = createTestEntries(SMALL_TEST_DATA, 10, 'Europe/London');
    const result = calculateAgp(entries, 'Europe/London');
    expect(result).toHaveLength(24);
    expect(result[10].time).toBe('10:00');
  });
});
