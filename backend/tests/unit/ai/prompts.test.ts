import { describe, it, expect } from 'vitest';
import { CLUSTER_AI_INSIGHT_PROMPT } from '@src/lib/ai/prompts';
import {
  GlucoseUnit,
  type GlycemicCluster,
  InsightPriority,
} from '@goodnumbers/types';

describe('AI Prompt Generation', () => {
  const mockCluster: GlycemicCluster = {
    id: 'c1',
    type: 'hyper',
    avgStartMinute: 420, // 07:00
    avgDurationMinutes: 120,
    eventCount: 1,
    activeDays: [1],
    events: [
      {
        id: 'e1',
        type: 'hyper',
        startTime: '2023-01-01T07:00:00Z',
        endTime: '2023-01-01T09:00:00Z',
        startMinuteOfDay: 420,
        durationMinutes: 120,
        readings: [
          { value: 200, timestamp: '2023-01-01T07:05:00Z' }, // Should round to 07:10
          { value: 250, timestamp: '2023-01-01T07:52:00Z' }, // Should round to 07:50
        ],
      },
    ],
  };

  const mockTreatments = [
    {
      date: new Date('2023-01-01T06:58:00Z').getTime(), // Rounds to 07:00
      carbs: 50,
      insulin: 5,
    },
  ];

  const deterministicInsights = [
    { priority: InsightPriority.IMPORTANT, note: 'Test insight' },
  ];

  it('rounds timestamps to the nearest 10 minutes in raw evidence', () => {
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      mockTreatments,
      'UTC',
    );

    // Reading at 07:05 -> 07:10
    expect(prompt).toContain('[07:10] 200 mg/dL');
    // Reading at 07:52 -> 07:50
    expect(prompt).toContain('[07:50] 250 mg/dL');
    // Treatment at 06:58 -> 07:00
    expect(prompt).toContain('[07:00] 50g carbs, 5u insulin');
  });

  it('respects the user preferred units (MMOL)', () => {
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MMOL,
      mockTreatments,
      'UTC',
    );

    // 200 mg/dL / 18 = 11.1 mmol/L
    expect(prompt).toContain('[07:10] 11.1 mmol/L');
    expect(prompt).toContain('Use mmol/L for ALL blood sugar values mentioned');
  });

  it('adjusts timestamps based on the provided timezone', () => {
    // Offset by -5 hours (New York)
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      mockTreatments,
      'America/New_York',
    );

    // 07:00 UTC is 02:00 EST
    expect(prompt).toContain('[02:00] 50g carbs, 5u insulin');
    expect(prompt).toContain('[02:10] 200 mg/dL');
  });

  it('enforces the concise structure and friendly persona', () => {
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      mockTreatments,
      'UTC',
    );

    expect(prompt).toContain('Key takeaway or observation:');
    expect(prompt).toContain('Recommendation:');
    expect(prompt).toContain('In detail:');
    expect(prompt).toContain('helpful diabetes coach');
    expect(prompt).toContain('friendly, plain English');
  });
});
