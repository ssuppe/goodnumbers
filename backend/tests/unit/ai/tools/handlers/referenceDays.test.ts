import { describe, it, expect, vi } from 'vitest';
import { handleReferenceDays } from '../../../../../src/lib/ai/tools/handlers/referenceDays.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import { NightscoutEntry } from '../../../../../src/lib/nightscout/types.js';

describe('Tool 3: find_successful_reference_days', () => {
  const timezone = 'America/New_York';

  function createEntry(isoString: string, sgvMgdl: number): NightscoutEntry {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `entry-${dt.toMillis()}`,
      date: dt.toMillis(),
      sgv: sgvMgdl,
      direction: 'Flat',
    } as unknown as NightscoutEntry;
  }

  it('finds best reference day with high TIR in morning window and quotes treatments', async () => {
    // Day 1 (Spiky morning): 2026-09-25
    const day1Entries = [
      createEntry('2026-09-25T07:00:00', 90),
      createEntry('2026-09-25T08:00:00', 220), // 12.2 mmol/L
      createEntry('2026-09-25T09:00:00', 210),
    ];

    // Day 2 (Success morning): 2026-09-26
    const day2Entries = [
      createEntry('2026-09-26T07:00:00', 95), // 5.3 mmol/L
      createEntry('2026-09-26T08:00:00', 125), // 6.9 mmol/L
      createEntry('2026-09-26T09:00:00', 110), // 6.1 mmol/L
    ];

    const mockTreatments = [
      {
        _id: 't-1',
        eventType: 'Meal Bolus',
        date: DateTime.fromISO('2026-09-26T07:15:00', {
          zone: timezone,
        }).toMillis(),
        carbs: 35,
        insulin: 3.5,
        notes: 'Pre-bolused oatmeal',
      },
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue([...day1Entries, ...day2Entries]),
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleReferenceDays(
      { targetWindow: 'morning', metric: 'high_tir', lookbackDays: 7 },
      context,
    );

    expect(result.foundSuccessDay).toBe(true);
    expect(result.bestDate).toContain('2026-09-26');
    expect(result.metrics?.tir).toBe(100);
    expect(result.metrics?.peak).toBe(6.9);
    expect(result.metrics?.nadir).toBe(5.3);
    expect(result.whatWorked).toContain('35g carbs');
    expect(result.whatWorked).toContain('3.5u bolus');
  });

  it('returns graceful message when no days meet success metric', async () => {
    const spikyEntries = [
      createEntry('2026-09-25T07:00:00', 210),
      createEntry('2026-09-25T08:00:00', 230),
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(spikyEntries),
      fetchTreatments: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleReferenceDays(
      { targetWindow: 'morning', metric: 'high_tir', lookbackDays: 3 },
      context,
    );

    expect(result.foundSuccessDay).toBe(false);
    expect(result.bestDate).toBeNull();
    expect(result.whatWorked).toContain('No day met the success criteria');
  });
});
