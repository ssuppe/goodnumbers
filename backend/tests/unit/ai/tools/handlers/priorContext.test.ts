import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePriorContext } from '../../../../../src/lib/ai/tools/handlers/priorContext.js';
import {
  ToolExecutionContext,
  clearToolCache,
} from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';
import { DateTime } from 'luxon';

import {
  NightscoutEntry,
  NightscoutTreatment,
} from '../../../../../src/lib/nightscout/types.js';

describe('Tool 10: inspect_prior_context', () => {
  const timezone = 'America/New_York';

  beforeEach(() => {
    clearToolCache();
  });

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
    insulin: number,
    notes?: string,
  ): NightscoutTreatment {
    const dt = DateTime.fromISO(isoString, { zone: timezone });
    return {
      _id: `t-${dt.toMillis()}`,
      date: dt.toMillis(),
      created_at: dt.toISO(),
      carbs,
      insulin,
      notes: notes || '',
      eventType: 'Bolus',
    } as unknown as NightscoutTreatment;
  }

  it('inspects 4-hour window before event timestamp and summarizes preceding treatments and trajectory', async () => {
    const targetTimestamp = '2026-09-29T15:30:00Z'; // 11:30 EDT or target in ISO
    const targetDt = DateTime.fromISO(targetTimestamp, { zone: timezone });

    // Starting at -4h (11:30): 110 mg/dL (6.1 mmol/L)
    // Peak at -1h20m (14:10): 216 mg/dL (12.0 mmol/L)
    // Crash at target (15:30): 68 mg/dL (3.8 mmol/L)
    const mockEntries = [
      createEntry(targetDt.minus({ hours: 4 }).toISO()!, 110),
      createEntry(targetDt.minus({ minutes: 80 }).toISO()!, 216),
      createEntry(targetDt.toISO()!, 68),
    ];

    const mockTreatments = [
      createTreatment(
        targetDt.minus({ hours: 2.5 }).toISO()!,
        60,
        6.0,
        'Lunch',
      ),
      createTreatment(
        targetDt.minus({ minutes: 75 }).toISO()!,
        0,
        2.0,
        'Correction for 11.2',
      ),
    ];

    const mockNsClient = {
      fetchEntries: vi.fn().mockResolvedValue(mockEntries),
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone,
      nsClient: mockNsClient,
    };

    const result = await handlePriorContext(
      { targetTimestamp, lookbackHours: 4 },
      context,
    );

    expect(result.targetTimestamp).toBe(targetTimestamp);
    expect(result.startingBgAtLookback).toBe(6.1);
    expect(result.interveningTreatments).toHaveLength(2);
    expect(result.interveningTreatments[0].carbs).toBe(60);
    expect(result.interveningTreatments[0].bolus).toBe(6.0);
    expect(result.interveningTreatments[1].bolus).toBe(2.0);
    expect(result.glucoseTrajectory).toContain('6.1');
    expect(result.glucoseTrajectory).toContain('3.8');
    expect(result.clinicalObservation).toBeDefined();
  });
});
