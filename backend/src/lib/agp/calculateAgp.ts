import { DateTime } from 'luxon';
import { quantile, mean } from 'd3-array';

// The minimum number of 5-minute data points required in an hourly bin
// 70% of 7 days * 12 points/hour = 59 points
const MIN_POINTS_THRESHOLD = 59;

// Constants for the 24 hourly time slots
const TIME_SLOTS = Array.from(
  { length: 24 },
  (_, i) => `${i.toString().padStart(2, '0')}:00`,
);

// Type definition for Nightscout entries used by the worker
export interface NightscoutEntry {
  date: number; // ISO 8601 UTC timestamp
  sgv: number; // Glucose value in mg/dL
  type: string; // 'sgv' or 'mbg'
}

// Type definition for the output AGP data point
export interface AgpDataPoint {
  time: string; // e.g., '00:00', '01:00'
  p5: number | null;
  p25: number | null;
  median: number | null;
  mean: number | null;
  p75: number | null;
  p95: number | null;
}

/**
 * Generates the Ambulatory Glucose Profile (AGP) data array.
 * Processes 7 days of raw glucose entries, binning by local time, and calculating percentiles.
 *
 * @param entries - Array of Nightscout entries (sgv is assumed to be in mg/dL).
 * @param timezone - User's preferred timezone string (e.g., 'America/New_York').
 * @returns An array of 24 AgpDataPoint objects.
 */
export function calculateAgp(
  entries: NightscoutEntry[],
  timezone: string,
): AgpDataPoint[] {
  // 1. Initialize 24 hourly buckets
  const hourlyBuckets = new Map<number, number[]>();
  for (let hour = 0; hour < 24; hour++) {
    hourlyBuckets.set(hour, []);
  }

  // 2. Localize, Filter, and Bin Data
  for (const entry of entries) {
    // Only process standard glucose values
    if (entry.type !== 'sgv' || entry.sgv <= 0) {
      continue;
    }

    // Parse UTC timestamp and convert to local time.
    // Using fromJSDate for robust UTC parsing, then setting the local zone for binning.
    const date = new Date(entry.date);
    const timestamp = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(
      timezone,
    );

    if (timestamp.isValid) {
      const hour = timestamp.hour;
      hourlyBuckets.get(hour)?.push(entry.sgv);
    }
  }

  // 3. Calculate Statistics for each hour
  const agpResult: AgpDataPoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const values = hourlyBuckets.get(hour) ?? [];
    const N = values.length;

    let p5: number | null = null;
    let p25: number | null = null;
    let medianValue: number | null = null;
    let p75: number | null = null;
    let p95: number | null = null;
    let meanValue: number | null = null;

    // Calculate Mean if any data exists
    if (N > 0) {
      // d3-array's mean function is highly robust
      meanValue = mean(values) ?? null;
    }

    // Calculate Percentiles only if the minimum threshold is met
    if (N >= MIN_POINTS_THRESHOLD) {
      // Sort data once for all percentile calculations - d3.quantile requires sorted data
      values.sort((a, b) => a - b);

      // d3.quantile uses the standard R-7 method, resolving the previous bug.
      p5 = quantile(values, 0.05) ?? null;
      p25 = quantile(values, 0.25) ?? null;
      medianValue = quantile(values, 0.5) ?? null;
      p75 = quantile(values, 0.75) ?? null;
      p95 = quantile(values, 0.95) ?? null;
    } else if (N > 0) {
      // Console log for debugging the data threshold during development
      console.log(
        `[AGP] Hour ${hour.toString().padStart(2, '0')}: Dropped percentiles due to low count (${N} < ${MIN_POINTS_THRESHOLD}).`,
      );
    }

    agpResult.push({
      time: TIME_SLOTS[hour],
      p5: p5 !== null && !isNaN(p5) ? p5 : null,
      p25: p25 !== null && !isNaN(p25) ? p25 : null,
      median: medianValue !== null && !isNaN(medianValue) ? medianValue : null,
      // Mean needs rounding for display/storage consistency.
      mean:
        meanValue !== null && !isNaN(meanValue)
          ? parseFloat(meanValue.toFixed(2))
          : null,
      p75: p75 !== null && !isNaN(p75) ? p75 : null,
      p95: p95 !== null && !isNaN(p95) ? p95 : null,
    });
  }

  // 4. Return result (all values are in mg/dL)
  return agpResult;
}
