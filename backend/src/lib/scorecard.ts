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
    return {
      avgGlucose: 0,
      stability: 0,
      timeInRange: 0,
      timeInTightRange: 0,
      timeBelowRange: 0,
    };

  // Filter out invalid SGVs immediately
  const validEntries = entries.filter((e) => Number.isFinite(e.sgv));
  if (!validEntries.length)
    return {
      avgGlucose: 0,
      stability: 0,
      timeInRange: 0,
      timeInTightRange: 0,
      timeBelowRange: 0,
    };

  const total = validEntries.length;
  const sum = validEntries.reduce((acc, e) => acc + e.sgv, 0);
  const inRange = validEntries.filter(
    (e) => e.sgv >= 70 && e.sgv <= 180,
  ).length;
  const tight = validEntries.filter((e) => e.sgv >= 70 && e.sgv <= 140).length;
  const belowRange = validEntries.filter((e) => e.sgv < 70).length;

  const mean = sum / total;
  const variance =
    validEntries.reduce((acc, e) => acc + Math.pow(e.sgv - mean, 2), 0) / total;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

  return {
    avgGlucose: safeRound(mean),
    timeInRange: safeRound((inRange / total) * 100),
    timeInTightRange: safeRound((tight / total) * 100),
    timeBelowRange: safeRound((belowRange / total) * 100),
    stability: safeRound(cv),
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
    timeBelowRange: safeRound(current.timeBelowRange - previous.timeBelowRange),
  };
}
