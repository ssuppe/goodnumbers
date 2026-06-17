import { describe, it, expect } from 'vitest';
import {
  CLUSTER_AI_INSIGHT_PROMPT,
  EXECUTIVE_SUMMARY_PROMPT,
} from '@src/lib/ai/prompts';
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
      { vibe: 'Sprouting', factors: 'Stress, Illness' },
    );

    // Reading at 07:10 (rounded)
    expect(prompt).toContain('[07:10] 200 mg/dL');
    // Reading at 07:50 (rounded)
    expect(prompt).toContain('[07:50] 250 mg/dL');
    // Treatment at 07:00 (rounded)
    expect(prompt).toContain('[07:00] 50g carbs, 5u insulin');
  });

  it('respects the user preferred units (MMOL)', () => {
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MMOL,
      mockTreatments,
      'UTC',
      { vibe: 'Sprouting', factors: 'Stress, Illness' },
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
      { vibe: 'Sprouting', factors: 'Stress, Illness' },
    );

    // 07:00 UTC is 02:00 EST
    expect(prompt).toContain('[02:00] 50g carbs, 5u insulin');
    expect(prompt).toContain('[02:10] 200 mg/dL');
  });

  it('enforces JSON structure for cluster assessment', () => {
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      mockTreatments,
      'UTC',
      { vibe: 'Sprouting', factors: 'Stress, Illness' },
    );

    expect(prompt).toContain('OUTPUT STRUCTURE:');
    expect(prompt).toContain('"assessment":');
    expect(prompt).toContain('"reflection_for_doctor":');
    expect(prompt).toContain('"quick_log_suggestions":');
    expect(prompt).toContain('ANALYSIS FRAMEWORK:');
    expect(prompt).toContain('TREND-FIRST:');
  });

  it('includes the weekly context in the prompt', () => {
    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      mockTreatments,
      'UTC',
      { vibe: '🌻 Flourishing', factors: 'Heavy exercise, Low stress' },
    );

    expect(prompt).toContain(
      "WEEKLY CONTEXT (User's subjective environmental factors):",
    );
    expect(prompt).toContain('- Overall Vibe: 🌻 Flourishing');
    expect(prompt).toContain(
      '- Influencing Factors: Heavy exercise, Low stress',
    );
  });

  it('identifies small insulin doses as automated corrections/SMBs', () => {
    const treatmentsWithSMB = [
      {
        date: new Date('2023-01-01T06:45:00Z').getTime(),
        insulin: 0.1,
      },
      {
        date: new Date('2023-01-01T06:55:00Z').getTime(),
        insulin: 0.2,
      },
      {
        date: new Date('2023-01-01T07:05:00Z').getTime(),
        insulin: 8.0, // Bolus
      },
    ];

    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      treatmentsWithSMB,
      'UTC',
      { vibe: 'Sprouting', factors: 'None' },
    );

    expect(prompt).toContain('0.1u insulin (Automated Correction/SMB)');
    expect(prompt).toContain('0.2u insulin (Automated Correction/SMB)');
    expect(prompt).toContain('8u insulin');
    expect(prompt).not.toContain('8u insulin (Automated Correction/SMB)');
  });

  it('does NOT flag small insulin doses as SMB if carbs are present', () => {
    const treatmentsWithSnack = [
      {
        date: new Date('2023-01-01T07:00:00Z').getTime(),
        insulin: 0.2,
        carbs: 5,
      },
    ];

    const prompt = CLUSTER_AI_INSIGHT_PROMPT(
      mockCluster,
      deterministicInsights,
      GlucoseUnit.MGDL,
      treatmentsWithSnack,
      'UTC',
      { vibe: 'Sprouting', factors: 'None' },
    );

    expect(prompt).toContain('5g carbs, 0.2u insulin');
    // Ensure the label is NOT present next to this specific treatment line
    expect(prompt).not.toContain('0.2u insulin (Automated Correction/SMB)');
  });

  describe('Executive Summary Prompt', () => {
    it('generates a prompt with current and previous stats', () => {
      const currentStats = {
        avgGlucose: 140,
        timeInRange: 75,
        stability: 80,
        lowPercentage: 2,
      };
      const previousStats = {
        avgGlucose: 150,
        timeInRange: 70,
        stability: 75,
      };

      const prompt = EXECUTIVE_SUMMARY_PROMPT(
        currentStats,
        previousStats,
        GlucoseUnit.MGDL,
      );

      expect(prompt).toContain('CURRENT WEEK STATS:');
      expect(prompt).toContain('Avg Glucose: 140 mg/dL');
      expect(prompt).toContain('Time In Range (TIR): 75%');
      expect(prompt).toContain('PREVIOUS WEEK STATS:');
      expect(prompt).toContain('TIR: 70%');
      expect(prompt).toContain('exactly 3 executive summary highlight cards');
      expect(prompt).toContain('JSON array of exactly 3 objects');
    });

    it('handles missing previous stats gracefully', () => {
      const currentStats = {
        avgGlucose: 140,
        timeInRange: 75,
        stability: 80,
        lowPercentage: 2,
      };

      const prompt = EXECUTIVE_SUMMARY_PROMPT(
        currentStats,
        null,
        GlucoseUnit.MGDL,
      );

      expect(prompt).toContain('No previous week data available');
    });

    it('includes patterns and clinical override rules', () => {
      const currentStats = {
        avgGlucose: 140,
        timeInRange: 75,
        stability: 80,
        lowPercentage: 2,
      };

      const prompt = EXECUTIVE_SUMMARY_PROMPT(
        currentStats,
        null,
        GlucoseUnit.MGDL,
        ['Largest positive variance: Afternoon (11:00 AM - 5:00 PM)'],
      );

      expect(prompt).toContain('DETECTED PATTERNS & HOTSPOTS');
      expect(prompt).toContain(
        'Largest positive variance: Afternoon (11:00 AM - 5:00 PM)',
      );
      expect(prompt).toContain('CLINICAL HYPO OVERRIDE');
    });
  });
});
