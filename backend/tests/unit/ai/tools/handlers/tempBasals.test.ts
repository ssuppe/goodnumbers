import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTempBasals } from '../../../../../src/lib/ai/tools/handlers/tempBasals.js';
import {
  ToolExecutionContext,
  clearToolCache,
} from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import { NightscoutTreatment } from '../../../../../src/lib/nightscout/types.js';

describe('Tool 8: get_temp_basal_and_suspends', () => {
  const timezone = 'America/New_York';

  beforeEach(() => {
    clearToolCache();
  });

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

  it('aggregates pump suspensions and temp basals over specified date range', async () => {
    const mockTreatments = [
      createTreatment('2026-09-28T03:15:00', {
        eventType: 'Pump Suspend',
        duration: 45,
        notes: 'Suspend for low predicted',
      }),
      createTreatment('2026-09-28T04:30:00', {
        eventType: 'Temp Basal',
        duration: 120,
        rate: 1.5,
        insulin: 3.0,
        notes: 'High temp basal',
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

    const result = await handleTempBasals(
      {
        startDate: '2026-09-28T00:00:00Z',
        endDate: '2026-09-28T12:00:00Z',
      },
      context,
    );

    expect(result.totalSuspendedMinutes).toBe(45);
    expect(result.highTempBasalMinutes).toBe(120);
    expect(result.automatedInsulinDelivered).toBe(3.0);
    expect(result.summary).toContain('suspended');
    expect(result.summary).toContain('temp basal');
  });

  it('returns graceful fallback message when no pump control events are logged', async () => {
    const mockNsClient = {
      fetchTreatments: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handleTempBasals(
      {
        startDate: '2026-09-28T00:00:00Z',
        endDate: '2026-09-28T12:00:00Z',
      },
      context,
    );

    expect(result.totalSuspendedMinutes).toBe(0);
    expect(result.highTempBasalMinutes).toBe(0);
    expect(result.automatedInsulinDelivered).toBe(0);
    expect(result.summary).toContain(
      'No pump suspension or automated temp basal records found',
    );
  });
});
