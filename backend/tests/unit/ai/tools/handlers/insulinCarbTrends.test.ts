import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInsulinCarbTrends } from '../../../../../src/lib/ai/tools/handlers/insulinCarbTrends.js';
import {
  ToolExecutionContext,
  clearToolCache,
} from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import { NightscoutTreatment } from '../../../../../src/lib/nightscout/types.js';

describe('Tool 9: get_daily_insulin_and_carb_trends', () => {
  const timezone = 'America/New_York';

  beforeEach(() => {
    clearToolCache();
  });

  function createTreatment(
    isoString: string,
    carbs: number,
    insulin: number,
  ): NightscoutTreatment {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `t-${dt.toMillis()}`,
      date: dt.toMillis(),
      created_at: dt.toISO(),
      carbs,
      insulin,
      eventType: 'Meal Bolus',
    } as unknown as NightscoutTreatment;
  }

  it('calculates average daily carbs, TDD, and basal/bolus percentage breakdown', async () => {
    // Profile with flat 1.0 u/hr basal = 24 u/day basal
    const mockProfile = [
      {
        defaultProfile: 'Standard',
        store: {
          Standard: {
            basal: [{ time: '00:00', value: 1.0 }],
          },
        },
      },
    ];

    // Day 1 (2026-09-28): 150g carbs, 20u bolus -> TDD = 20 + 24 = 44u
    // Day 2 (2026-09-29): 170g carbs, 28u bolus -> TDD = 28 + 24 = 52u
    // Average carbs: (150+170)/2 = 160g
    // Average TDD: (44+52)/2 = 48u
    // Average bolus: 24u (50%), Average basal: 24u (50%)
    const mockTreatments = [
      createTreatment('2026-09-28T08:00:00', 50, 6),
      createTreatment('2026-09-28T13:00:00', 60, 8),
      createTreatment('2026-09-28T19:00:00', 40, 6),
      createTreatment('2026-09-29T08:00:00', 60, 10),
      createTreatment('2026-09-29T13:00:00', 70, 12),
      createTreatment('2026-09-29T19:00:00', 40, 6),
    ];

    const mockNsClient = {
      fetchProfile: vi.fn().mockResolvedValue(mockProfile),
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleInsulinCarbTrends({ days: 7 }, context);

    expect(result.averageDailyCarbs).toBe(160);
    expect(result.averageDailyInsulin).toBe(48);
    expect(result.basalPercentage).toBe(50);
    expect(result.bolusPercentage).toBe(50);
    expect(result.trend).toBeDefined();
  });
});
