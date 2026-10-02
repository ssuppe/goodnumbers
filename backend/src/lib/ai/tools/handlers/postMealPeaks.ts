import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutEntries,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';
import { formatGlucose } from './utils.js';

interface MealDefinition {
  startHour: number;
  endHour: number;
  defaultHour: number;
  defaultMinute: number;
}

const MEAL_DEFINITIONS: Record<string, MealDefinition> = {
  breakfast: {
    startHour: 6.0,
    endHour: 10.0,
    defaultHour: 8,
    defaultMinute: 0,
  },
  lunch: {
    startHour: 11.5,
    endHour: 14.5,
    defaultHour: 12,
    defaultMinute: 30,
  },
  dinner: {
    startHour: 17.5,
    endHour: 21.0,
    defaultHour: 18,
    defaultMinute: 30,
  },
};

export async function handlePostMealPeaks(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const mealName = String(args.meal || 'lunch').toLowerCase();
  const mealDef = MEAL_DEFINITIONS[mealName] || MEAL_DEFINITIONS.lunch;
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 14);

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days }).startOf('day');

  const [entries, treatments] = await Promise.all([
    getCachedNightscoutEntries(context, from.toJSDate(), now.toJSDate()),
    getCachedNightscoutTreatments(context, from.toJSDate(), now.toJSDate()),
  ]);

  // Group entries by day
  const entriesByDay: Record<string, typeof entries> = {};
  for (const e of entries) {
    if (typeof e.sgv !== 'number' || e.sgv <= 0) continue;
    const dt = DateTime.fromMillis(e.date, { zone });
    const key = dt.toFormat('yyyy-MM-dd');
    if (!entriesByDay[key]) entriesByDay[key] = [];
    entriesByDay[key].push(e);
  }

  interface MealDayStat {
    preMealMgdl: number;
    peakMgdl: number;
    timeToPeakMins: number;
    returnedToTarget: boolean;
  }

  const mealStats: MealDayStat[] = [];

  for (const [dayStr, dayEntries] of Object.entries(entriesByDay)) {
    if (dayEntries.length < 2) continue;

    // Look for meal treatment on this day
    const dayTreatments = treatments.filter((t) => {
      const millis =
        t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
      if (!millis) return false;
      const tDt = DateTime.fromMillis(millis, { zone });
      if (tDt.toFormat('yyyy-MM-dd') !== dayStr) return false;
      const decHour = tDt.hour + tDt.minute / 60;
      return decHour >= mealDef.startHour && decHour < mealDef.endHour;
    });

    let mealStartMillis: number;

    if (dayTreatments.length > 0) {
      // Pick treatment with carbs or earliest in window
      const withCarbs = dayTreatments.find((t) => (t.carbs || 0) > 0);
      const chosen = withCarbs || dayTreatments[0];
      mealStartMillis =
        chosen.date ||
        (chosen.created_at ? new Date(chosen.created_at).getTime() : 0);
    } else {
      // Find entries within meal window
      const windowEntries = dayEntries.filter((e) => {
        const eDt = DateTime.fromMillis(e.date, { zone });
        const decHour = eDt.hour + eDt.minute / 60;
        return decHour >= mealDef.startHour && decHour < mealDef.endHour;
      });
      if (windowEntries.length === 0) continue;
      mealStartMillis = Math.min(...windowEntries.map((e) => e.date));
    }

    // Pre-meal baseline: reading closest to mealStartMillis (within -30 to +15 mins)
    const baselineCandidates = dayEntries.filter(
      (e) => Math.abs(e.date - mealStartMillis) <= 35 * 60 * 1000,
    );
    if (baselineCandidates.length === 0) continue;
    baselineCandidates.sort(
      (a, b) =>
        Math.abs(a.date - mealStartMillis) - Math.abs(b.date - mealStartMillis),
    );
    const preMeal = baselineCandidates[0];

    // Postprandial readings: 0 to 3 hours after mealStartMillis
    const threeHoursMillis = 3 * 60 * 60 * 1000;
    const postprandial = dayEntries.filter(
      (e) =>
        e.date >= mealStartMillis &&
        e.date <= mealStartMillis + threeHoursMillis,
    );
    if (postprandial.length === 0) continue;

    // Peak reading
    let peakEntry = postprandial[0];
    for (const e of postprandial) {
      if (e.sgv > peakEntry.sgv) {
        peakEntry = e;
      }
    }

    const timeToPeakMins = Math.round(
      Math.max(0, (peakEntry.date - mealStartMillis) / (60 * 1000)),
    );

    // Reading at ~3 hours
    const endCandidates = dayEntries.filter(
      (e) =>
        Math.abs(e.date - (mealStartMillis + threeHoursMillis)) <=
        35 * 60 * 1000,
    );
    const returnedToTarget =
      endCandidates.length > 0 && endCandidates[0].sgv <= 180;

    mealStats.push({
      preMealMgdl: preMeal.sgv,
      peakMgdl: peakEntry.sgv,
      timeToPeakMins,
      returnedToTarget,
    });
  }

  if (mealStats.length === 0) {
    return {
      meal: mealName,
      averagePreMealBg: null,
      averagePeakBg: null,
      averageRise: null,
      averageTimeToPeakMinutes: null,
      returnedToTargetWithin3Hours: 'No meal data found for this period',
    };
  }

  const avgPreMealMgdl =
    mealStats.reduce((s, m) => s + m.preMealMgdl, 0) / mealStats.length;
  const avgPeakMgdl =
    mealStats.reduce((s, m) => s + m.peakMgdl, 0) / mealStats.length;
  const avgRiseMgdl = avgPeakMgdl - avgPreMealMgdl;
  const avgTimeToPeak = Math.round(
    mealStats.reduce((s, m) => s + m.timeToPeakMins, 0) / mealStats.length,
  );
  const returnedCount = mealStats.filter((m) => m.returnedToTarget).length;

  return {
    meal: mealName,
    averagePreMealBg: formatGlucose(avgPreMealMgdl, context.preferredUnits),
    averagePeakBg: formatGlucose(avgPeakMgdl, context.preferredUnits),
    averageRise: formatGlucose(avgRiseMgdl, context.preferredUnits),
    averageTimeToPeakMinutes: avgTimeToPeak,
    returnedToTargetWithin3Hours: `${returnedCount} out of ${mealStats.length} days`,
  };
}
