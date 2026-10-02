import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutEntries,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';
import { formatGlucose } from './utils.js';

export async function handleSearchNotes(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const query = String(args.query || '')
    .trim()
    .toLowerCase();
  const days = Math.min(Math.max(Number(args.days) || 14, 1), 14);

  if (!query) {
    return {
      query: '',
      matchesCount: 0,
      entries: [],
    };
  }

  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days }).startOf('day');

  const [treatments, entries] = await Promise.all([
    getCachedNightscoutTreatments(context, from.toJSDate(), now.toJSDate()),
    getCachedNightscoutEntries(context, from.toJSDate(), now.toJSDate()),
  ]);

  const matchingTreatments = treatments.filter((t) =>
    (t.notes || '').toLowerCase().includes(query),
  );

  // Sort matching treatments chronologically
  matchingTreatments.sort((a, b) => {
    const aTime =
      a.date || (a.created_at ? new Date(a.created_at).getTime() : 0);
    const bTime =
      b.date || (b.created_at ? new Date(b.created_at).getTime() : 0);
    return aTime - bTime;
  });

  const results: Array<{
    timestamp: string;
    note: string;
    glucoseAtTime: number | null;
  }> = [];

  for (const t of matchingTreatments) {
    const tTime =
      t.date || (t.created_at ? new Date(t.created_at).getTime() : 0);
    const dt = DateTime.fromMillis(tTime, { zone });

    // Find nearest glucose reading within 25 minutes
    const nearby = entries.filter(
      (e) => Math.abs(e.date - tTime) <= 25 * 60 * 1000,
    );
    let glucoseAtTime: number | null = null;
    if (nearby.length > 0) {
      nearby.sort(
        (a, b) => Math.abs(a.date - tTime) - Math.abs(b.date - tTime),
      );
      glucoseAtTime = formatGlucose(nearby[0].sgv, context.preferredUnits);
    }

    results.push({
      timestamp: dt.toISO() || t.created_at,
      note: t.notes || '',
      glucoseAtTime,
    });
  }

  return {
    query,
    matchesCount: results.length,
    entries: results,
  };
}
