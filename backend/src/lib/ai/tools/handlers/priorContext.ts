import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutEntries,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';
import { formatGlucose } from './utils.js';

export async function handlePriorContext(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const zone = context.timezone || 'UTC';
  const targetIso =
    (args.targetTimestamp as string) ||
    DateTime.now().setZone(zone).toISO() ||
    new Date().toISOString();
  const targetDt = DateTime.fromISO(targetIso, { zone });
  const lookbackHours = Math.min(
    Math.max(Number(args.lookbackHours) || 4, 1),
    8,
  );
  const startDt = targetDt.minus({ hours: lookbackHours });

  const [entries, treatments] = await Promise.all([
    getCachedNightscoutEntries(
      context,
      startDt.toJSDate(),
      targetDt.toJSDate(),
    ),
    getCachedNightscoutTreatments(
      context,
      startDt.toJSDate(),
      targetDt.toJSDate(),
    ),
  ]);

  // Sort chronologically
  const validEntries = entries
    .filter((e) => typeof e.sgv === 'number' && e.sgv > 0)
    .sort((a, b) => a.date - b.date);

  const validTreatments = treatments
    .filter((t) => {
      const millis =
        t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
      return millis >= startDt.toMillis() && millis <= targetDt.toMillis();
    })
    .sort((a, b) => {
      const aTime =
        a.date || (a.created_at ? new Date(a.created_at).getTime() : 0);
      const bTime =
        b.date || (b.created_at ? new Date(b.created_at).getTime() : 0);
      return aTime - bTime;
    });

  // Starting and ending BG
  const startEntry = validEntries[0];
  const endEntry = validEntries[validEntries.length - 1];

  const startingBg = startEntry
    ? formatGlucose(startEntry.sgv, context.preferredUnits)
    : null;
  const endingBg = endEntry
    ? formatGlucose(endEntry.sgv, context.preferredUnits)
    : null;

  // Intervening treatments list
  const interveningTreatments = validTreatments.map((t) => {
    const millis =
      t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
    const dt = DateTime.fromMillis(millis, { zone });
    return {
      time: dt.toFormat('HH:mm'),
      carbs: Number(t.carbs) || 0,
      bolus: Number(t.insulin) || 0,
      notes: t.notes || '',
    };
  });

  // Glucose trajectory narrative
  let glucoseTrajectory = 'Data sparse in lookback window.';
  let clinicalObservation = 'No abnormal prior events identified.';

  if (validEntries.length >= 2 && startEntry && endEntry) {
    let peakEntry = validEntries[0];
    for (const e of validEntries) {
      if (e.sgv > peakEntry.sgv) peakEntry = e;
    }
    const peakDt = DateTime.fromMillis(peakEntry.date, { zone });
    const peakVal = formatGlucose(peakEntry.sgv, context.preferredUnits);

    if (
      peakEntry.sgv > startEntry.sgv + 35 &&
      endEntry.sgv < peakEntry.sgv - 35
    ) {
      glucoseTrajectory = `Rose from ${startingBg} to ${peakVal} at ${peakDt.toFormat('HH:mm')}, then dropped sharply to ${endingBg} at ${targetDt.toFormat('HH:mm')}`;
    } else {
      glucoseTrajectory = `Traveled from ${startingBg} at ${startDt.toFormat('HH:mm')} to ${endingBg} at ${targetDt.toFormat('HH:mm')} (peak ${peakVal})`;
    }

    // Clinical observation heuristics
    const boluses = interveningTreatments.filter((t) => t.bolus > 0);
    if (boluses.length >= 2) {
      clinicalObservation =
        'Multiple boluses logged within a short window (possible insulin stacking).';
    } else if (
      endingBg !== null &&
      ((context.preferredUnits === 'mmol/L' && endingBg < 4.0) || endingBg < 70)
    ) {
      clinicalObservation =
        'Excursion ended in hypoglycemia following preceding insulin or activity.';
    } else if (peakEntry.sgv > 200) {
      clinicalObservation =
        'Significant postprandial glucose spike prior to event.';
    }
  }

  return {
    targetTimestamp: targetIso,
    startingBgAtLookback: startingBg,
    interveningTreatments,
    glucoseTrajectory,
    clinicalObservation,
  };
}
