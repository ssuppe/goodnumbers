import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutEntries,
} from '../dispatcher.js';
import { formatGlucose, calculateTir } from './utils.js';

function computeDayStats(readings: number[], units: 'mmol/L' | 'mg/dL') {
  if (readings.length === 0) {
    return { tir: 0, mean: 0, cv: 0, count: 0 };
  }
  const meanMgdl = readings.reduce((a, b) => a + b, 0) / readings.length;
  const variance =
    readings.reduce((sum, v) => sum + Math.pow(v - meanMgdl, 2), 0) /
    readings.length;
  const sd = Math.sqrt(variance);
  const cv = Math.round((sd / meanMgdl) * 100);

  return {
    tir: calculateTir(readings),
    mean: formatGlucose(meanMgdl, units),
    cv,
    count: readings.length,
  };
}

export async function handleDayOfWeekPattern(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const comparisonType =
    (args.comparisonType as string) || 'weekday_vs_weekend';
  const lookbackWeeks = Math.min(
    Math.max(Number(args.lookbackWeeks) || 3, 1),
    4,
  );
  const specificDay = (args.specificDay as string) || 'Monday';

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ weeks: lookbackWeeks }).startOf('day');

  const entries = await getCachedNightscoutEntries(
    context,
    from.toJSDate(),
    now.toJSDate(),
  );

  if (comparisonType === 'specific_day') {
    const dayReadings: number[] = [];
    for (const e of entries) {
      if (typeof e.sgv !== 'number' || e.sgv <= 0) continue;
      const dt = DateTime.fromMillis(e.date, { zone });
      if (dt.toFormat('cccc').toLowerCase() === specificDay.toLowerCase()) {
        dayReadings.push(e.sgv);
      }
    }

    const metrics = computeDayStats(dayReadings, context.preferredUnits);
    return {
      comparison: 'specific_day',
      day: specificDay,
      evaluatedWeeks: lookbackWeeks,
      metrics,
    };
  }

  // weekday_vs_weekend or day_of_week
  const weekdayReadings: number[] = [];
  const weekendReadings: number[] = [];

  for (const e of entries) {
    if (typeof e.sgv !== 'number' || e.sgv <= 0) continue;
    const dt = DateTime.fromMillis(e.date, { zone });
    if (dt.weekday >= 1 && dt.weekday <= 5) {
      weekdayReadings.push(e.sgv);
    } else {
      weekendReadings.push(e.sgv);
    }
  }

  const weekdayStats = computeDayStats(weekdayReadings, context.preferredUnits);
  const weekendStats = computeDayStats(weekendReadings, context.preferredUnits);

  let keyObservation = 'Weekday and weekend glycemic metrics are comparable.';
  if (weekdayStats.tir - weekendStats.tir > 15) {
    keyObservation = `Weekdays show significantly better stability (TIR ${weekdayStats.tir}% vs ${weekendStats.tir}% on weekends).`;
  } else if (weekendStats.tir - weekdayStats.tir > 15) {
    keyObservation = `Weekends show higher time in range (TIR ${weekendStats.tir}% vs ${weekdayStats.tir}% on weekdays).`;
  } else if (weekendStats.cv > weekdayStats.cv + 10) {
    keyObservation = `Weekends show higher glycemic variability (CV ${weekendStats.cv}% vs ${weekdayStats.cv}%).`;
  }

  return {
    comparison: 'weekday_vs_weekend',
    weekday: weekdayStats,
    weekend: weekendStats,
    keyObservation,
  };
}
