import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutEntries,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';
import { formatGlucose, calculateTir } from './utils.js';

interface WindowBounds {
  startHour: number;
  endHour: number;
}

function getWindowBounds(targetWindow: string): WindowBounds {
  switch (targetWindow) {
    case 'morning':
      return { startHour: 6.0, endHour: 10.0 };
    case 'lunch':
      return { startHour: 11.5, endHour: 14.5 };
    case 'afternoon':
      return { startHour: 14.0, endHour: 18.0 };
    case 'evening':
      return { startHour: 18.0, endHour: 22.0 };
    case 'overnight':
      return { startHour: 0.0, endHour: 6.0 };
    case 'full_day':
    default:
      return { startHour: 0.0, endHour: 24.0 };
  }
}

function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export async function handleReferenceDays(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const targetWindow = (args.targetWindow as string) || 'full_day';
  const metric = (args.metric as string) || 'high_tir';
  const lookbackDays = Math.min(
    Math.max(Number(args.lookbackDays) || 14, 1),
    14,
  );

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days: lookbackDays }).startOf('day');

  const bounds = getWindowBounds(targetWindow);

  const entries = await getCachedNightscoutEntries(
    context,
    from.toJSDate(),
    now.toJSDate(),
  );

  // Group readings by day
  const dayBuckets: Record<string, { readings: number[]; dt: DateTime }> = {};

  for (const entry of entries) {
    if (typeof entry.sgv !== 'number' || entry.sgv <= 0) continue;
    const dt = DateTime.fromMillis(entry.date, { zone });
    const decimalHour = dt.hour + dt.minute / 60;

    if (decimalHour >= bounds.startHour && decimalHour < bounds.endHour) {
      const dateKey = dt.toFormat('yyyy-MM-dd (cccc)');
      if (!dayBuckets[dateKey]) {
        dayBuckets[dateKey] = { readings: [], dt };
      }
      dayBuckets[dateKey].readings.push(entry.sgv);
    }
  }

  interface CandidateDay {
    dateKey: string;
    readings: number[];
    dt: DateTime;
    tir: number;
    peakMgdl: number;
    nadirMgdl: number;
    score: number;
  }

  const candidates: CandidateDay[] = [];

  for (const [dateKey, item] of Object.entries(dayBuckets)) {
    const readings = item.readings;
    if (readings.length < 2) continue; // Need minimum readings

    const tir = calculateTir(readings);
    const peakMgdl = Math.max(...readings);
    const nadirMgdl = Math.min(...readings);
    const sd = calculateStdDev(readings);
    const rise = peakMgdl - nadirMgdl;

    let qualifies = false;
    let score = 0;

    switch (metric) {
      case 'high_tir':
        qualifies = tir >= 80 && nadirMgdl >= 70;
        score = tir;
        break;
      case 'no_hypo':
        qualifies = nadirMgdl >= 70 && tir >= 70;
        score = nadirMgdl + tir;
        break;
      case 'flat_overnight':
        qualifies = sd < 25 && nadirMgdl >= 70 && peakMgdl <= 180;
        score = 100 - sd;
        break;
      case 'minimal_post_meal_spike':
        qualifies = rise <= 55 && peakMgdl <= 180;
        score = 100 - rise;
        break;
      default:
        qualifies = tir >= 75;
        score = tir;
    }

    if (qualifies) {
      candidates.push({
        dateKey,
        readings,
        dt: item.dt,
        tir,
        peakMgdl,
        nadirMgdl,
        score,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      foundSuccessDay: false,
      bestDate: null,
      metrics: null,
      whatWorked: `No day met the success criteria (${metric}) for ${targetWindow} in the past ${lookbackDays} days.`,
    };
  }

  // Sort candidates by highest score
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Look for treatments on this best day around the target window
  let whatWorked = `Consistent steady range maintained throughout the ${targetWindow} window.`;

  try {
    const treatments = await getCachedNightscoutTreatments(
      context,
      from.toJSDate(),
      now.toJSDate(),
    );

    const bestDayStart = best.dt
      .startOf('day')
      .plus({ hours: Math.max(0, bounds.startHour - 1) });
    const bestDayEnd = best.dt.startOf('day').plus({ hours: bounds.endHour });

    const dayTreatments = treatments.filter((t) => {
      const tTime =
        t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
      return tTime >= bestDayStart.toMillis() && tTime <= bestDayEnd.toMillis();
    });

    const relevant = dayTreatments.filter(
      (t) => (t.carbs && t.carbs > 0) || (t.insulin && t.insulin > 0),
    );
    if (relevant.length > 0) {
      const parts = relevant.map((t) => {
        const details = [];
        if (t.carbs) details.push(`${t.carbs}g carbs`);
        if (t.insulin) details.push(`${t.insulin}u bolus`);
        if (t.notes) details.push(`"${t.notes}"`);
        return details.join(' with ');
      });
      whatWorked = `Logged ${parts.join(', ')}. Glucose remained stable with peak ${formatGlucose(best.peakMgdl, context.preferredUnits)}.`;
    }
  } catch (err) {
    console.warn(
      '[Tool: referenceDays] Failed to query treatments for context:',
      err,
    );
  }

  return {
    foundSuccessDay: true,
    bestDate: best.dateKey,
    metrics: {
      tir: best.tir,
      peak: formatGlucose(best.peakMgdl, context.preferredUnits),
      nadir: formatGlucose(best.nadirMgdl, context.preferredUnits),
    },
    whatWorked,
  };
}
