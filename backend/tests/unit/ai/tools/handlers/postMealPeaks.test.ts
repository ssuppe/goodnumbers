import { describe, it, expect, vi } from 'vitest';
import { handlePostMealPeaks } from '../../../../../src/lib/ai/tools/handlers/postMealPeaks.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import {
  NightscoutEntry,
  NightscoutTreatment,
} from '../../../../../src/lib/nightscout/types.js';

describe('Tool 6: get_post_meal_peak_trends', () => {
  const timezone = 'America/New_York';

  function createEntry(isoString: string, sgvMgdl: number): NightscoutEntry {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `e-${dt.toMillis()}`,
      date: dt.toMillis(),
      sgv: sgvMgdl,
      direction: 'Flat',
    } as unknown as NightscoutEntry;
  }

  function createTreatment(
    isoString: string,
    carbs: number,
  ): NightscoutTreatment {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `t-${dt.toMillis()}`,
      date: dt.toMillis(),
      created_at: dt.toISO(),
      carbs,
      insulin: 4.0,
      eventType: 'Meal Bolus',
    } as unknown as NightscoutTreatment;
  }

  it('calculates average pre-meal BG, peak BG, rise, and time-to-peak for lunch', async () => {
    // Lunch on Day 1: 12:00
    // Pre-meal at 12:00: 110 mg/dL (6.1 mmol/L)
    // Peak at 13:15 (+75 min): 205 mg/dL (11.4 mmol/L) -> rise 95 mg/dL (5.3 mmol/L)
    // 3h later at 15:00: 130 mg/dL (returned to target <= 180)
    const day1Entries = [
      createEntry('2026-09-28T12:00:00', 110),
      createEntry('2026-09-28T12:30:00', 160),
      createEntry('2026-09-28T13:15:00', 205),
      createEntry('2026-09-28T14:00:00', 170),
      createEntry('2026-09-28T15:00:00', 130),
    ];
    const day1Treatment = createTreatment('2026-09-28T12:00:00', 50);

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(day1Entries),
      fetchTreatments: vi.fn().mockResolvedValue([day1Treatment]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handlePostMealPeaks(
      { meal: 'lunch', days: 7 },
      context,
    );

    expect(result.meal).toBe('lunch');
    expect(result.averagePreMealBg).toBe(6.1);
    expect(result.averagePeakBg).toBe(11.4);
    expect(result.averageRise).toBe(5.3);
    expect(result.averageTimeToPeakMinutes).toBe(75);
    expect(result.returnedToTargetWithin3Hours).toContain('1 out of 1 days');
  });

  it('falls back to standard meal hour if no meal bolus treatments logged', async () => {
    // Lunch time window without treatments: 12:30
    const entries = [
      createEntry('2026-09-28T12:30:00', 100),
      createEntry('2026-09-28T13:30:00', 170),
      createEntry('2026-09-28T15:30:00', 120),
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(entries),
      fetchTreatments: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mg/dL',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handlePostMealPeaks({ meal: 'lunch' }, context);
    expect(result.meal).toBe('lunch');
    expect(result.averagePreMealBg).toBe(100);
    expect(result.averagePeakBg).toBe(170);
    expect(result.averageRise).toBe(70);
  });
});
