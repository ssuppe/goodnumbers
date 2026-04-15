import { GlucoseEntry } from '@goodnumbers/types';
import { ScoreCardData } from '@goodnumbers/schemas';

function safeRound(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function calculateMetrics(
  entries: GlucoseEntry[],
): Omit<ScoreCardData, 'trends'> {
  if (!entries.length)
    return { avgGlucose: 0, stability: 0, timeInRange: 0, timeInTightRange: 0 };

  // Filter out invalid SGVs immediately
  const validEntries = entries.filter((e) => Number.isFinite(e.sgv));
  if (!validEntries.length)
    return { avgGlucose: 0, stability: 0, timeInRange: 0, timeInTightRange: 0 };

  const total = validEntries.length;
  const sum = validEntries.reduce((acc, e) => acc + e.sgv, 0);
  const inRange = validEntries.filter(
    (e) => e.sgv >= 70 && e.sgv <= 180,
  ).length;
  const tight = validEntries.filter((e) => e.sgv >= 70 && e.sgv <= 140).length;

  let stableIntervals = 0;
  let totalIntervals = 0;

  // Sort by date to ensure correct ROC calculation
  const sorted = [...validEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    const timeDiffMin =
      (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 60000;

    // Only calculate ROC if readings are close enough (<= 15 mins)
    if (timeDiffMin > 0 && timeDiffMin <= 15) {
      const roc = Math.abs(curr.sgv - prev.sgv) / timeDiffMin;
      if (roc < 1.5) stableIntervals++;
      totalIntervals++;
    }
  }

  return {
    avgGlucose: safeRound(sum / total),
    timeInRange: safeRound((inRange / total) * 100),
    timeInTightRange: safeRound((tight / total) * 100),
    stability:
      totalIntervals > 0
        ? safeRound((stableIntervals / totalIntervals) * 100)
        : 0,
  };
}

export function calculateTrends(
  current: Omit<ScoreCardData, 'trends'>,
  previous: Omit<ScoreCardData, 'trends'> | null,
) {
  if (!previous) return null;
  return {
    avgGlucose: safeRound(current.avgGlucose - previous.avgGlucose),
    stability: safeRound(current.stability - previous.stability),
    timeInRange: safeRound(current.timeInRange - previous.timeInRange),
    timeInTightRange: safeRound(
      current.timeInTightRange - previous.timeInTightRange,
    ),
  };
}
