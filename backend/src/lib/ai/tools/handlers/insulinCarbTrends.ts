import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';

import { NightscoutProfile } from '../../../nightscout/types.js';

function calculateDailyBasalFromProfile(profiles: NightscoutProfile[]): number {
  if (!profiles || profiles.length === 0) return 20.0;
  const p = profiles[0];
  const profileName =
    p.defaultProfile || (p.store ? Object.keys(p.store)[0] : undefined);
  if (!profileName || !p.store || !p.store[profileName]) return 20.0;

  const basal = p.store[profileName].basal;
  if (!Array.isArray(basal) || basal.length === 0) return 20.0;

  if (basal.length === 1) {
    return (Number(basal[0].value) || 0) * 24;
  }

  // Calculate piecewise hourly integration
  let totalDailyBasal = 0;
  for (let i = 0; i < basal.length; i++) {
    const current = basal[i];
    const next = basal[(i + 1) % basal.length];

    const [currH, currM] = (current.time || '00:00').split(':').map(Number);
    const [nextH, nextM] = (next.time || '24:00').split(':').map(Number);

    const startMinutes = currH * 60 + (currM || 0);
    let endMinutes = nextH * 60 + (nextM || 0);

    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }

    const durationHours = (endMinutes - startMinutes) / 60;
    totalDailyBasal += (Number(current.value) || 0) * durationHours;
  }

  return Math.round(totalDailyBasal * 10) / 10;
}

export async function handleInsulinCarbTrends(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 14);

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days }).startOf('day');

  let dailyBasal = 20.0;
  try {
    const profiles = await context.nsClient.fetchProfile();
    dailyBasal = calculateDailyBasalFromProfile(profiles);
  } catch (err) {
    console.warn(
      '[Tool: insulinCarbTrends] Could not fetch profile for basal:',
      err,
    );
  }

  const treatments = await getCachedNightscoutTreatments(
    context,
    from.toJSDate(),
    now.toJSDate(),
  );

  // Group by day
  const dailyTotals: Record<string, { carbs: number; bolus: number }> = {};

  for (const t of treatments) {
    const millis =
      t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
    if (!millis) continue;
    const dt = DateTime.fromMillis(millis, { zone });
    const dayKey = dt.toFormat('yyyy-MM-dd');

    if (!dailyTotals[dayKey]) {
      dailyTotals[dayKey] = { carbs: 0, bolus: 0 };
    }

    dailyTotals[dayKey].carbs += Number(t.carbs) || 0;
    dailyTotals[dayKey].bolus += Number(t.insulin) || 0;
  }

  const dayKeys = Object.keys(dailyTotals);

  if (dayKeys.length === 0) {
    return {
      averageDailyCarbs: 0,
      averageDailyInsulin: dailyBasal,
      basalPercentage: 100,
      bolusPercentage: 0,
      trend: 'No carb or bolus treatments logged for this period.',
    };
  }

  const totalCarbs = dayKeys.reduce((sum, d) => sum + dailyTotals[d].carbs, 0);
  const totalBolus = dayKeys.reduce((sum, d) => sum + dailyTotals[d].bolus, 0);

  const avgCarbs = Math.round(totalCarbs / dayKeys.length);
  const avgBolus = totalBolus / dayKeys.length;
  const avgTdd = Math.round((avgBolus + dailyBasal) * 10) / 10;

  const bolusPercentage = Math.round((avgBolus / avgTdd) * 100);
  const basalPercentage = 100 - bolusPercentage;

  const trend = `Daily average intake is ${avgCarbs}g carbs with TDD of ${avgTdd}u (${bolusPercentage}% bolus, ${basalPercentage}% basal).`;

  return {
    averageDailyCarbs: avgCarbs,
    averageDailyInsulin: avgTdd,
    basalPercentage,
    bolusPercentage,
    trend,
  };
}
