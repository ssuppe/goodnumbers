import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedNightscoutEntries,
  ToolExecutionContext,
  clearToolCache,
} from '../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../src/lib/nightscout/client.js';

describe('Local-First Fast Path in Dispatcher', () => {
  const mockNsClient = {
    fetchEntries: vi.fn(),
    fetchTreatments: vi.fn(),
  } as unknown as NightscoutClient;

  beforeEach(() => {
    clearToolCache();
    vi.clearAllMocks();
  });

  it('serves CGM readings directly from localJournalData.bloodGlucose without calling Nightscout', async () => {
    const t1 = new Date('2026-09-25T00:00:00Z').getTime();
    const t2 = new Date('2026-09-26T00:00:00Z').getTime();
    const t3 = new Date('2026-09-27T00:00:00Z').getTime();

    const localPoints = [
      { date: t1, sgv: 110, direction: 'Flat' },
      { date: t2, sgv: 130, direction: 'Flat' },
      { date: t3, sgv: 120, direction: 'Flat' },
    ];

    const context: ToolExecutionContext = {
      userId: 'fast-path-user',
      preferredUnits: 'mmol/L',
      timezone: 'UTC',
      nsClient: mockNsClient,
      localJournalData: {
        bloodGlucose: localPoints,
        startDate: new Date('2026-09-24T00:00:00Z'),
        endDate: new Date('2026-09-28T00:00:00Z'),
      },
    };

    const from = new Date('2026-09-25T06:00:00Z');
    const to = new Date('2026-09-26T18:00:00Z');

    const result = await getCachedNightscoutEntries(context, from, to);

    expect(result).toHaveLength(1);
    expect(result[0].sgv).toBe(130);
    expect(mockNsClient.fetchEntries).not.toHaveBeenCalled(); // 0 network calls!
  });

  it('falls back to live Nightscout query when requested time window extends beyond local journal data', async () => {
    const t1 = new Date('2026-09-25T00:00:00Z').getTime();
    const localPoints = [{ date: t1, sgv: 110 }];

    vi.mocked(mockNsClient.fetchEntries).mockResolvedValueOnce([
      {
        date: 1726000000000,
        sgv: 140,
      } as unknown as import('../../../../src/lib/nightscout/types.js').NightscoutEntry,
    ]);

    const context: ToolExecutionContext = {
      userId: 'fast-path-user',
      preferredUnits: 'mmol/L',
      timezone: 'UTC',
      nsClient: mockNsClient,
      localJournalData: {
        bloodGlucose: localPoints,
        startDate: new Date('2026-09-24T00:00:00Z'),
        endDate: new Date('2026-09-26T00:00:00Z'),
      },
    };

    // Asking for 14 days back (far before local startDate)
    const from = new Date('2026-09-10T00:00:00Z');
    const to = new Date('2026-09-25T00:00:00Z');

    const result = await getCachedNightscoutEntries(context, from, to);

    expect(mockNsClient.fetchEntries).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].sgv).toBe(140);
  });
});
