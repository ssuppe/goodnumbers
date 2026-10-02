import { describe, it, expect, vi } from 'vitest';
import { handleSearchNotes } from '../../../../../src/lib/ai/tools/handlers/searchNotes.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import {
  NightscoutTreatment,
  NightscoutEntry,
} from '../../../../../src/lib/nightscout/types.js';

describe('Tool 7: search_treatment_notes', () => {
  const timezone = 'America/New_York';

  function createTreatment(
    isoString: string,
    notes: string,
  ): NightscoutTreatment {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `t-${dt.toMillis()}`,
      date: dt.toMillis(),
      created_at: dt.toISO(),
      notes,
      eventType: 'Note',
    } as unknown as NightscoutTreatment;
  }

  function createEntry(isoString: string, sgvMgdl: number): NightscoutEntry {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `e-${dt.toMillis()}`,
      date: dt.toMillis(),
      sgv: sgvMgdl,
      direction: 'Flat',
    } as unknown as NightscoutEntry;
  }

  it('searches treatment notes case-insensitively and returns correlated BG at time', async () => {
    const mockTreatments = [
      createTreatment('2026-09-27T19:30:00', 'Evening dog walk in park'),
      createTreatment('2026-09-29T13:45:00', '15 min walk after lunch'),
      createTreatment('2026-09-29T18:00:00', 'Pasta dinner'),
    ];

    const mockEntries = [
      createEntry('2026-09-27T19:32:00', 117), // 6.5 mmol/L
      createEntry('2026-09-29T13:45:00', 148), // 8.2 mmol/L
    ];

    const mockNsClient = {
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
      fetchEntries: vi.fn().mockResolvedValue(mockEntries),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleSearchNotes(
      { query: 'walk', days: 14 },
      context,
    );

    expect(result.query).toBe('walk');
    expect(result.matchesCount).toBe(2);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].note).toBe('Evening dog walk in park');
    expect(result.entries[0].glucoseAtTime).toBe(6.5);
    expect(result.entries[1].note).toBe('15 min walk after lunch');
    expect(result.entries[1].glucoseAtTime).toBe(8.2);
  });

  it('returns empty matches when query does not match any notes', async () => {
    const mockTreatments = [
      createTreatment('2026-09-29T18:00:00', 'Pasta dinner'),
    ];

    const mockNsClient = {
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
      fetchEntries: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleSearchNotes({ query: 'alcohol' }, context);
    expect(result.matchesCount).toBe(0);
    expect(result.entries).toEqual([]);
  });
});
