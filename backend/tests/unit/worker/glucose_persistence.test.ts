import { describe, it, expect } from 'vitest';
import { trimGlucoseEntriesForPersistence } from '../../../src/lib/agp/trimGlucose.js';
import { NightscoutEntry } from '../../../src/lib/nightscout/types.js';

describe('Glucose Snapshot Trimming for Persistence', () => {
  it('strips redundant Nightscout metadata and preserves compact date, sgv, and direction', () => {
    const rawEntries: NightscoutEntry[] = [
      {
        _id: 'ns-1',
        app: 'dexcom',
        date: 1727500000000,
        device: 'G7',
        direction: 'Flat',
        isReadOnly: false,
        isValid: true,
        sgv: 115,
        type: 'sgv',
        unfiltered: 115000,
        units: 'mg/dL',
        utcOffset: -240,
        created_at: '2026-09-28T04:00:00Z',
        identifier: 'id-1',
        srvModified: 1727500001000,
        srvCreated: 1727500001000,
        subject: 'sub',
        modifiedBy: 'user',
        mills: 1727500000000,
      },
      {
        _id: 'ns-2',
        app: 'dexcom',
        date: 1727500300000,
        device: 'G7',
        direction: 'FortyFiveUp',
        isReadOnly: false,
        isValid: true,
        sgv: 125,
        type: 'sgv',
        unfiltered: 125000,
        units: 'mg/dL',
        utcOffset: -240,
        created_at: '2026-09-28T04:05:00Z',
        identifier: 'id-2',
        srvModified: 1727500301000,
        srvCreated: 1727500301000,
        subject: 'sub',
        modifiedBy: 'user',
        mills: 1727500300000,
      },
    ];

    const compact = trimGlucoseEntriesForPersistence(rawEntries);

    expect(compact).toHaveLength(2);
    expect(compact[0]).toEqual({
      date: 1727500000000,
      sgv: 115,
      direction: 'Flat',
    });
    expect(compact[1]).toEqual({
      date: 1727500300000,
      sgv: 125,
      direction: 'FortyFiveUp',
    });
    expect((compact[0] as Record<string, unknown>).unfiltered).toBeUndefined();
    expect((compact[0] as Record<string, unknown>).app).toBeUndefined();
  });

  it('filters out invalid or missing glucose readings', () => {
    const rawEntries: Array<Record<string, unknown>> = [
      { date: 1727500000000, sgv: 120, direction: 'Flat' },
      { date: 1727500300000, sgv: null },
      { date: 1727500600000, sgv: -1 },
    ];

    const compact = trimGlucoseEntriesForPersistence(rawEntries);
    expect(compact).toHaveLength(1);
    expect(compact[0].sgv).toBe(120);
  });
});
