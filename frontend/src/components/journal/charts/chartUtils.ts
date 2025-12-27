import type { GlycemicCluster } from "@goodnumbers/types";

/**
 * Calculates the optimal hour to split the chart to avoid breaking clusters.
 * It finds the largest gap in the data and uses its midpoint as the start of the day.
 *
 * @param cluster The glycemic cluster containing events
 * @returns An hour (0-23) representing the start of the chart's 24h window
 */
export function getBoundaryHour(cluster: GlycemicCluster): number {
  const minutesSet = new Set<number>();

  // Collect all unique timestamps converted to minutes-from-midnight (UTC)
  cluster.events.forEach((e) => {
    e.readings.forEach((r) => {
      const d = new Date(r.timestamp);
      minutesSet.add(d.getUTCHours() * 60 + d.getUTCMinutes());
    });
  });

  if (minutesSet.size === 0) return 0;

  const sortedMinutes = Array.from(minutesSet).sort((a, b) => a - b);
  let maxGap = 0;
  let gapStart = 0;

  // 1. Check gaps between consecutive sorted points
  for (let i = 0; i < sortedMinutes.length - 1; i++) {
    const gap = sortedMinutes[i + 1] - sortedMinutes[i];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = sortedMinutes[i];
    }
  }

  // 2. Check the "wraparound" gap (end of day to start of day)
  // Example: Last point 23:00 (1380), First point 01:00 (60)
  // Gap = (1440 - 1380) + 60 = 60 + 60 = 120 minutes
  const lastPoint = sortedMinutes[sortedMinutes.length - 1];
  const firstPoint = sortedMinutes[0];
  const wrapGap = 1440 - lastPoint + firstPoint;

  // If the wraparound gap is the largest (or equal), it means the standard midnight split
  // is the best (data is bunched in the middle of the day). Return 0.
  if (wrapGap >= maxGap) {
    return 0;
  }

  // Otherwise, the best split is in the middle of the largest internal gap.
  // Example: Data at 23:00 (1380) and 01:00 (60).
  // Internal Gap is 1380 - 60 = 1320 minutes (22 hours).
  // Midpoint is 60 + (1320 / 2) = 60 + 660 = 720 minutes (12:00).
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
  } else {
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
