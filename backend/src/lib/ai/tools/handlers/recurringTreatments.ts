import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';

export async function handleRecurringTreatments(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const startHour = Number(args.startHour) || 0;
  const endHour = Number(args.endHour) || 24;
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 14);
  const treatmentType = (args.treatmentType as string) || 'all';

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days }).startOf('day');

  const treatments = await getCachedNightscoutTreatments(
    context,
    from.toJSDate(),
    now.toJSDate(),
  );

  const treatmentsByDay: Array<{
    date: string;
    carbs: number;
    bolus: number;
    notes: string;
    type: string;
  }> = [];

  for (const t of treatments) {
    const millis =
      t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
    if (!millis) continue;

    const dt = DateTime.fromMillis(millis, { zone });
    const decimalHour = dt.hour + dt.minute / 60;

    if (decimalHour >= startHour && decimalHour < endHour) {
      const carbs = Number(t.carbs) || 0;
      const bolus = Number(t.insulin) || 0;
      const notes = t.notes || '';

      if (treatmentType === 'carbs' && carbs <= 0) continue;
      if (treatmentType === 'insulin' && bolus <= 0) continue;
      if (treatmentType === 'notes' && !notes.trim()) continue;

      treatmentsByDay.push({
        date: dt.toFormat('yyyy-MM-dd'),
        carbs,
        bolus,
        notes,
        type: t.eventType || 'treatment',
      });
    }
  }

  // Sort chronologically by date
  treatmentsByDay.sort((a, b) => a.date.localeCompare(b.date));

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  return {
    timeWindow: `${formatHour(startHour)} - ${formatHour(endHour)}`,
    treatmentsByDay,
  };
}
