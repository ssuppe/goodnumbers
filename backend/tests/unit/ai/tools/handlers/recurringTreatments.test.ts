import { describe, it, expect, vi } from 'vitest';
import { handleRecurringTreatments } from '../../../../../src/lib/ai/tools/handlers/recurringTreatments.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import { NightscoutTreatment } from '../../../../../src/lib/nightscout/types.js';

describe('Tool 4: get_treatments_for_recurring_window', () => {
  const timezone = 'America/New_York';

  function createTreatment(
    isoString: string,
    data: Record<string, unknown>,
  ): NightscoutTreatment {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `t-${dt.toMillis()}`,
      date: dt.toMillis(),
      created_at: dt.toISO(),
      ...data,
    } as unknown as NightscoutTreatment;
  }

  it('filters treatments by recurring clock hour bracket (e.g. 21:00-24:00)', async () => {
    const mockTreatments = [
      // Day 1 - Inside window (21:30)
      createTreatment('2026-09-28T21:30:00', {
        eventType: 'Meal Bolus',
        carbs: 25,
        insulin: 1.5,
        notes: 'popcorn',
      }),
      // Day 1 - Outside window (12:00)
      createTreatment('2026-09-28T12:00:00', {
        eventType: 'Meal Bolus',
        carbs: 50,
        insulin: 5.0,
      }),
      // Day 2 - Inside window (22:15)
      createTreatment('2026-09-29T22:15:00', {
        eventType: 'Correction Bolus',
        carbs: 0,
        insulin: 0.8,
        notes: 'Correction',
      }),
    ];

    const mockNsClient = {
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleRecurringTreatments(
      { startHour: 21, endHour: 24, days: 7 },
      context,
    );

    expect(result.timeWindow).toBe('21:00 - 24:00');
    expect(result.treatmentsByDay).toHaveLength(2);

    expect(result.treatmentsByDay[0].date).toBe('2026-09-28');
    expect(result.treatmentsByDay[0].carbs).toBe(25);
    expect(result.treatmentsByDay[0].bolus).toBe(1.5);
    expect(result.treatmentsByDay[0].notes).toBe('popcorn');

    expect(result.treatmentsByDay[1].date).toBe('2026-09-29');
    expect(result.treatmentsByDay[1].bolus).toBe(0.8);
  });

  it('filters by treatmentType when specified (e.g. only carbs)', async () => {
    const mockTreatments = [
      createTreatment('2026-09-28T21:30:00', {
        eventType: 'Meal Bolus',
        carbs: 25,
        insulin: 1.5,
      }),
      createTreatment('2026-09-28T22:15:00', {
        eventType: 'Correction Bolus',
        carbs: 0,
        insulin: 1.0,
      }),
    ];

    const mockNsClient = {
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleRecurringTreatments(
      { startHour: 21, endHour: 24, treatmentType: 'carbs' },
      context,
    );

    expect(result.treatmentsByDay).toHaveLength(1);
    expect(result.treatmentsByDay[0].carbs).toBe(25);
  });
});
