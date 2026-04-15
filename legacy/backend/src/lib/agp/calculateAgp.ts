import { DateTime } from 'luxon';
import { quantile, mean } from 'd3-array';

// 30-minute bins over 7 days.
// Expected points per bin: 12 points/hour * 0.5 hours * 7 days * 100% capture = 42 points max.
// Let's set a reasonable threshold to ensure statistical significance.
const MIN_POINTS_THRESHOLD = 30;

// Constants for the 48 (30-minute) time slots
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

// Type definition for Nightscout entries used by the worker
export interface NightscoutEntry {
  date: number; // ISO 8601 UTC timestamp
  sgv: number; // Glucose value in mg/dL
  type: string; // 'sgv' or 'mbg'
}

// Type definition for the output AGP data point
export interface AgpDataPoint {
  time: string; // e.g., '00:00', '00:30'
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
 * @returns An array of 48 AgpDataPoint objects.
 */
export function calculateAgp(
  entries: NightscoutEntry[],
  timezone: string,
): AgpDataPoint[] {
  // 1. Initialize 48 half-hourly buckets
  const bucketMap = new Map<number, number[]>();
  for (let i = 0; i < 48; i++) {
    bucketMap.set(i, []);
  }

  // 2. Localize, Filter, and Bin Data
  for (const entry of entries) {
    // Only process standard glucose values
    if (entry.type !== 'sgv' || entry.sgv <= 0) {
      continue;
    }

    // Parse UTC timestamp and convert to local time.
    const date = new Date(entry.date);
    const timestamp = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(
      timezone,
    );

    if (timestamp.isValid) {
      // Calculate 30-minute bin index (0 - 47)
      // e.g., 00:29 -> bin 0, 00:31 -> bin 1
      const binIndex = (timestamp.hour * 2) + Math.floor(timestamp.minute / 30);
      bucketMap.get(binIndex)?.push(entry.sgv);
    }
  }

  // 3. Calculate Statistics for each bin
  const agpResult: AgpDataPoint[] = [];

  for (let i = 0; i < 48; i++) {
    const values = bucketMap.get(i) ?? [];
    const N = values.length;

    let p5: number | null = null;
    let p25: number | null = null;
    let medianValue: number | null = null;
    let p75: number | null = null;
    let p95: number | null = null;
    let meanValue: number | null = null;

    // Calculate Mean if any data exists
    if (N > 0) {
      meanValue = mean(values) ?? null;
    }

    // Calculate Percentiles only if the minimum threshold is met
    if (N >= MIN_POINTS_THRESHOLD) {
      values.sort((a, b) => a - b);

      p5 = quantile(values, 0.05) ?? null;
      p25 = quantile(values, 0.25) ?? null;
      medianValue = quantile(values, 0.5) ?? null;
      p75 = quantile(values, 0.75) ?? null;
      p95 = quantile(values, 0.95) ?? null;
    } else if (N > 0) {
      // Debug log
      // console.log(`[AGP] Bin ${i}: Dropped percentiles due to low count (${N} < ${MIN_POINTS_THRESHOLD}).`);
    }

    agpResult.push({
      time: TIME_SLOTS[i],
      p5: p5 !== null && !isNaN(p5) ? p5 : null,
      p25: p25 !== null && !isNaN(p25) ? p25 : null,
      median: medianValue !== null && !isNaN(medianValue) ? medianValue : null,
      mean:
        meanValue !== null && !isNaN(meanValue)
          ? parseFloat(meanValue.toFixed(2))
          : null,
      p75: p75 !== null && !isNaN(p75) ? p75 : null,
      p95: p95 !== null && !isNaN(p95) ? p95 : null,
    });
  }

  // 4. Return result
  return agpResult;
}