import type { GlycemicCluster } from "@goodnumbers/types";

/**
 * Calculates the optimal hour to split the chart to avoid breaking clusters.
 * It finds the largest gap in the data and uses its midpoint as the start of the day.
 *
 * @param cluster The glycemic cluster containing events
 * @param additionalTimestamps Optional array of other relevant timestamps (e.g. treatments) to consider
 * @returns An hour (0-23) representing the start of the chart's 24h window
 */
export function getBoundaryHour(cluster: GlycemicCluster, additionalTimestamps: number[] = []): number {
  const minutesSet = new Set<number>();

  // 1. Collect minutes from Cluster Events
  cluster.events.forEach((e) => {
    e.readings.forEach((r) => {
      const d = new Date(r.timestamp);
      minutesSet.add(d.getUTCHours() * 60 + d.getUTCMinutes());
    });
  });

  // 2. Collect minutes from Additional Timestamps (Treatments)
  additionalTimestamps.forEach((ts) => {
    const d = new Date(ts);
    minutesSet.add(d.getUTCHours() * 60 + d.getUTCMinutes());
  });

  if (minutesSet.size === 0) return 0;

  const sortedMinutes = Array.from(minutesSet).sort((a, b) => a - b);
  let maxGap = 0;
  let gapStart = 0;

  // 3. Check gaps between consecutive sorted points
  for (let i = 0; i < sortedMinutes.length - 1; i++) {
    const gap = sortedMinutes[i + 1] - sortedMinutes[i];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = sortedMinutes[i];
    }
  }

  // 4. Check the "wraparound" gap (end of day to start of day)
  const lastPoint = sortedMinutes[sortedMinutes.length - 1];
  const firstPoint = sortedMinutes[0];
  const wrapGap = 1440 - lastPoint + firstPoint;

  if (wrapGap >= maxGap) {
    return 0;
  }

  const midpointMinute = gapStart + maxGap / 2;
  return Math.floor(midpointMinute / 60);
}

/**
 * Normalizes a timestamp to a consistent 24-hour window (Jan 1st or Jan 2nd, 2000).
 * Shifts the window based on the boundaryHour.
 *
 * @param isoString The original timestamp string
 * @param boundaryHour The hour (0-23) where the chart starts
 * @returns A timestamp normalized to Year 2000
 */
export const normalizeTime = (isoString: string, boundaryHour: number) => {
  const d = new Date(isoString);
  const h = d.getUTCHours();

  d.setUTCFullYear(2000);
  d.setUTCMonth(0); // January

  // If the hour is smaller than our boundary, it belongs to the "logical" next day
  // relative to the start of our window.
  if (h < boundaryHour) {
    d.setUTCDate(2);
  }
  else {
    d.setUTCDate(1);
  }
  return d.getTime();
};

/**
 * Formats a timestamp into a short 12-hour format (e.g., "6am", "12pm").
 * Uses UTC methods to match the normalized time data.
 *
 * @param value Timestamp in milliseconds
 */
export const formatAxisLabel = (value: number) => {
  const d = new Date(value);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  // Append minutes only if non-zero
  const minuteStr = m > 0 ? `:${m.toString().padStart(2, "0")}` : "";
  return `${h12}${minuteStr}${ampm}`;
};

/**
 * Calculates a common time domain for multiple series to ensure synchronized x-axes.
 * 
 * @param seriesList List of ECharts series objects containing data
 * @param paddingMinutes Number of minutes to add as buffer to start and end
 * @returns Object with min/max timestamps, or null if no data
 */
export function calculateCommonDomain(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seriesList: { data: { value: (number | string)[] }[] }[],
  paddingMinutes: number = 30
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let hasData = false;

  for (const series of seriesList) {
    if (!series.data) continue;
    for (const item of series.data) {
      // Normalized timestamp is at index 0
      const time = item.value[0];
      if (typeof time === 'number') {
        if (time < min) min = time;
        if (time > max) max = time;
        hasData = true;
      }
    }
  }

  if (!hasData) return null;

  const padding = paddingMinutes * 60 * 1000;
  return {
    min: min - padding,
    max: max + padding
  };
}
