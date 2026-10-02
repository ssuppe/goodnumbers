import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';

export async function handleTempBasals(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const zone = context.timezone || 'UTC';

  let fromDate: Date;
  let toDate: Date;

  try {
    fromDate = DateTime.fromISO(args.startDate as string, { zone }).toJSDate();
    toDate = DateTime.fromISO(args.endDate as string, { zone }).toJSDate();
  } catch {
    const now = DateTime.now().setZone(zone);
    toDate = now.toJSDate();
    fromDate = now.minus({ days: 1 }).toJSDate();
  }

  const treatments = await getCachedNightscoutTreatments(
    context,
    fromDate,
    toDate,
  );

  let totalSuspendedMinutes = 0;
  let highTempBasalMinutes = 0;
  let automatedInsulinDelivered = 0;

  const relevantEvents: string[] = [];

  for (const t of treatments) {
    const evType = (t.eventType || '').toLowerCase();
    const duration = Number(t.duration) || 0;

    if (evType.includes('suspend')) {
      const mins = duration || 30; // standard default duration if unstated
      totalSuspendedMinutes += mins;
      relevantEvents.push(`Pump suspended delivery for ${mins} mins`);
    } else if (evType.includes('temp basal') || evType.includes('temp_basal')) {
      highTempBasalMinutes += duration;
      const delivered = Number(t.insulin) || 0;
      automatedInsulinDelivered += delivered;
      relevantEvents.push(`Temp basal active for ${duration} mins`);
    }
  }

  if (totalSuspendedMinutes === 0 && highTempBasalMinutes === 0) {
    return {
      totalSuspendedMinutes: 0,
      highTempBasalMinutes: 0,
      automatedInsulinDelivered: 0,
      summary:
        'No pump suspension or automated temp basal records found in Nightscout for this period.',
    };
  }

  const summary = `Pump suspended for ${totalSuspendedMinutes} mins total with ${highTempBasalMinutes} mins of automated temp basal adjustments.`;

  return {
    totalSuspendedMinutes,
    highTempBasalMinutes,
    automatedInsulinDelivered: Math.round(automatedInsulinDelivered * 10) / 10,
    summary,
  };
}
