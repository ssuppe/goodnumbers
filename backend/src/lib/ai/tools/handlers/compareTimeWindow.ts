import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutEntries,
} from '../dispatcher.js';
import { formatGlucose, calculateTir } from './utils.js';

interface WindowBounds {
  startHour: number;
  endHour: number;
  label: string;
}

function resolveWindowBounds(
  timeWindow?: string,
  customStart?: number,
  customEnd?: number,
): WindowBounds {
  if (customStart !== undefined && customEnd !== undefined) {
    return {
      startHour: customStart,
      endHour: customEnd,
      label: `custom (${customStart}:00-${customEnd}:00)`,
    };
  }

  switch (timeWindow) {
    case 'morning':
      return { startHour: 6.0, endHour: 10.0, label: 'morning (06:00-10:00)' };
    case 'lunch':
      return { startHour: 11.5, endHour: 14.5, label: 'lunch (11:30-14:30)' };
    case 'afternoon':
      return {
        startHour: 14.0,
        endHour: 18.0,
        label: 'afternoon (14:00-18:00)',
      };
    case 'evening':
      return { startHour: 18.0, endHour: 22.0, label: 'evening (18:00-22:00)' };
    case 'overnight':
      return { startHour: 0.0, endHour: 6.0, label: 'overnight (00:00-06:00)' };
    default:
      return { startHour: 6.0, endHour: 10.0, label: 'morning (06:00-10:00)' };
  }
}

export async function handleCompareTimeWindow(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 14);
  const bounds = resolveWindowBounds(
    args.timeWindow as string | undefined,
    args.customStartHour !== undefined
      ? Number(args.customStartHour)
      : undefined,
    args.customEndHour !== undefined ? Number(args.customEndHour) : undefined,
  );

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days }).startOf('day');

  const entries = await getCachedNightscoutEntries(
    context,
    from.toJSDate(),
    now.toJSDate(),
  );

  // Group entries by date that fall within clock time bounds
  const dayBuckets: Record<string, number[]> = {};

  for (const entry of entries) {
    if (typeof entry.sgv !== 'number' || entry.sgv <= 0) continue;
    const dt = DateTime.fromMillis(entry.date, { zone });
    const decimalHour = dt.hour + dt.minute / 60;

    if (decimalHour >= bounds.startHour && decimalHour < bounds.endHour) {
      const dateKey = dt.toFormat('yyyy-MM-dd (ccc)');
      if (!dayBuckets[dateKey]) {
        dayBuckets[dateKey] = [];
      }
      dayBuckets[dateKey].push(entry.sgv);
    }
  }

  const sortedDates = Object.keys(dayBuckets).sort();

  if (sortedDates.length === 0) {
    return {
      window: bounds.label,
      daysEvaluated: 0,
      dailyBreakdown: [],
      consistency: `No readings found for ${bounds.label} in the past ${days} days.`,
    };
  }

  const dailyBreakdown = sortedDates.map((date) => {
    const readings = dayBuckets[date];
    const meanMgdl = readings.reduce((a, b) => a + b, 0) / readings.length;
    const minMgdl = Math.min(...readings);
    const maxMgdl = Math.max(...readings);
    const tir = calculateTir(readings);

    let pattern = 'stable';
    if (tir < 60) {
      pattern = maxMgdl > 200 ? 'elevated spike' : 'unstable';
    } else if (maxMgdl - minMgdl > 90) {
      pattern = 'variable';
    }

    return {
      date,
      mean: formatGlucose(meanMgdl, context.preferredUnits),
      min: formatGlucose(minMgdl, context.preferredUnits),
      max: formatGlucose(maxMgdl, context.preferredUnits),
      tir,
      pattern,
    };
  });

  const avgTir =
    dailyBreakdown.reduce((sum, d) => sum + d.tir, 0) / dailyBreakdown.length;

  let consistency = `Evaluated across ${sortedDates.length} days.`;
  if (avgTir >= 80) {
    consistency = `Consistently in range across evaluated days (average TIR ${Math.round(avgTir)}%).`;
  } else if (avgTir < 50) {
    consistency = `Frequent out-of-range patterns detected (average TIR ${Math.round(avgTir)}%).`;
  }

  return {
    window: bounds.label,
    daysEvaluated: sortedDates.length,
    dailyBreakdown,
    consistency,
  };
}
