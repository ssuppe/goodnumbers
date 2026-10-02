import { NightscoutEntry } from '../nightscout/types.js';

export interface CompactGlucosePoint {
  date: number;
  sgv: number;
  direction?: string;
}

export function trimGlucoseEntriesForPersistence(
  entries: NightscoutEntry[],
): CompactGlucosePoint[] {
  return entries
    .filter((e) => typeof e.sgv === 'number' && e.sgv > 0)
    .map((e) => ({
      date: e.date,
      sgv: e.sgv,
      direction: e.direction,
    }));
}
