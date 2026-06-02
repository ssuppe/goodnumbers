import type { GlycemicCluster } from "@goodnumbers/types";

/**
 * Extracts the wall-clock time from an ISO string and creates a local Date object
 * that matches those exact numbers, completely ignoring time zones.
 * This ensures "18:00-04:00" and "18:00Z" both render as 6:00 PM local.
 */
export function getLocalWallClockDate(isoString: string | number | Date): Date {
  if (typeof isoString !== "string") return new Date(isoString);
  const match = isoString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return new Date(isoString);
  const [, y, m, d, h, min, s] = match.map(Number);
  return new Date(y, m - 1, d, h, min, s);
}

/**
 * Calculates the optimal hour to split the chart to avoid breaking clusters.
 * It finds the largest gap in the data and uses its midpoint as the start of the day.
 */
export function getBoundaryHour(
  cluster: GlycemicCluster,
  additionalTimestamps: string[] = [],
): number {
  const minutesSet = new Set<number>();

  cluster.events.forEach((e) => {
    e.readings.forEach((r) => {
      const d = getLocalWallClockDate(r.timestamp);
      minutesSet.add(d.getHours() * 60 + d.getMinutes());
    });
  });

  additionalTimestamps.forEach((ts) => {
    const d = getLocalWallClockDate(ts);
    minutesSet.add(d.getHours() * 60 + d.getMinutes());
  });

  if (minutesSet.size === 0) return 0;

  const sortedMinutes = Array.from(minutesSet).sort((a, b) => a - b);
  let maxGap = 0;
  let gapStart = 0;

  for (let i = 0; i < sortedMinutes.length - 1; i++) {
    const gap = sortedMinutes[i + 1] - sortedMinutes[i];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = sortedMinutes[i];
    }
  }

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
 */
export const normalizeTime = (isoString: string, boundaryHour: number) => {
  const d = getLocalWallClockDate(isoString);
  const h = d.getHours();

  const norm = new Date(
    2000,
    0,
    1,
    h,
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );

  if (h < boundaryHour) {
    norm.setDate(2);
  }
  return norm.getTime();
};

/**
 * Formats a timestamp into a short 12-hour format (e.g., "6am", "12pm").
 */
export const formatAxisLabel = (value: number) => {
  const d = new Date(value);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  const minuteStr = m > 0 ? `:${m.toString().padStart(2, "0")}` : "";
  return `${h12}${minuteStr}${ampm}`;
};

/**
 * Calculates a common time domain for multiple series to ensure synchronized x-axes.
 */
export function calculateCommonDomain(
  seriesList: { data: { value: (number | string)[] }[] }[],
  paddingMinutes: number = 30,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let hasData = false;

  for (const series of seriesList) {
    if (!series.data) continue;
    for (const item of series.data) {
      const time = item.value[0];
      if (typeof time === "number") {
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
    max: max + padding,
  };
}
