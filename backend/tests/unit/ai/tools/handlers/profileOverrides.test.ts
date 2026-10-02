import { describe, it, expect, vi } from 'vitest';
import { handleProfileOverrides } from '../../../../../src/lib/ai/tools/handlers/profileOverrides.js';
import { ToolExecutionContext } from '../../../../../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../../../../../src/lib/nightscout/client.js';

describe('Tool 2: get_profile_and_override_history', () => {
  it('extracts active profile information and recent override/switch events', async () => {
    const mockProfile = [
      {
        defaultProfile: 'Standard Autumn 2026',
        store: {
          'Standard Autumn 2026': {
            dia: 5,
            timezone: 'America/New_York',
            basal: [
              { time: '00:00', value: 0.65 },
              { time: '07:00', value: 0.85 },
            ],
            carbratio: [{ time: '00:00', value: 10 }],
            sens: [{ time: '00:00', value: 45 }],
            target_low: [{ time: '00:00', value: 70 }],
            target_high: [{ time: '00:00', value: 180 }],
            units: 'mg/dL',
          },
        },
      },
    ];

    const mockTreatments = [
      {
        _id: 't-1',
        eventType: 'Profile Switch',
        created_at: '2026-09-27T08:30:00Z',
        notes: "Switched from 'Sick Day' to 'Standard Autumn 2026'",
      },
      {
        _id: 't-2',
        eventType: 'Temp Target',
        created_at: '2026-09-29T16:00:00Z',
        notes: 'Exercise mode (Target 8.0 for 90 mins)',
        duration: 90,
      },
      {
        _id: 't-3',
        eventType: 'Meal Bolus',
        created_at: '2026-09-29T12:00:00Z',
        carbs: 45,
        insulin: 4.5,
      },
    ];

    const mockNsClient = {
      fetchProfile: vi.fn().mockResolvedValue(mockProfile),
      fetchTreatments: vi.fn().mockResolvedValue(mockTreatments),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone: 'America/New_York',
      nsClient: mockNsClient,
    };

    const result = await handleProfileOverrides({ days: 7 }, context);

    expect(result.activeProfileName).toBe('Standard Autumn 2026');
    expect(result.activeBasalSummary).toBeDefined();
    expect(result.recentSwitches).toHaveLength(2);
    expect(result.recentSwitches[0].event).toBe('Profile Switch');
    expect(result.recentSwitches[1].event).toBe('Temp Target');
  });

  it('handles empty profile or missing overrides gracefully', async () => {
    const mockNsClient = {
      fetchProfile: vi.fn().mockResolvedValue([]),
      fetchTreatments: vi.fn().mockResolvedValue([]),
    } as unknown as NightscoutClient;

    const context: ToolExecutionContext = {
      userId: 'user-1',
      preferredUnits: 'mmol/L',
      timezone: 'America/New_York',
      nsClient: mockNsClient,
    };

    const result = await handleProfileOverrides({}, context);
    expect(result.activeProfileName).toBe('Default / Unknown');
    expect(result.recentSwitches).toEqual([]);
  });
});
