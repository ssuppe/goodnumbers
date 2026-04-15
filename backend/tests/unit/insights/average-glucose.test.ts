import { describe, it, expect } from 'vitest';
import { createAvgGlucoseInsight } from '../../../src/lib/insights/average-glucose';
import { GlucoseUnit, InsightPriority } from '@goodnumbers/types';
import { AnalysisResult } from '../../../src/lib/insights/interfaces';

// Helper to create a mock analysis result with defaults
const createAnalysis = (
  overrides: Partial<AnalysisResult>,
): AnalysisResult => ({
  avgGlucose: 100,
  lowPercentage: 0,
  highPercentage: 0,
  timeInRange: 100,
  ...overrides,
});

describe('createAvgGlucoseInsight', () => {
  // Constants for readability in tests
  const UNIT_MGDL = GlucoseUnit.MGDL;
  const UNIT_MMOL = GlucoseUnit.MMOL;

  describe('State A: Critical Low (avg < 70)', () => {
    it('returns CRITICAL priority and warning text', () => {
      const analysis = createAnalysis({ avgGlucose: 65, lowPercentage: 5 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      expect(result.priority).toBe(InsightPriority.CRITICAL);
      expect(result.note).toContain('dangerously low');
      expect(result.note).toContain('65'); // Check value formatting
    });
  });

  describe('State B: Masked Low (avg < 140 AND TBR > 4%)', () => {
    it('returns CRITICAL priority and "hidden lows" text', () => {
      const analysis = createAnalysis({ avgGlucose: 110, lowPercentage: 10 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      expect(result.priority).toBe(InsightPriority.CRITICAL);
      expect(result.note).toContain('hiding a problem');
      expect(result.note).toContain('10.0%'); // Mentions the TBR
    });

    it('triggers exactly at 139 mg/dL and 4.1% TBR', () => {
      const analysis = createAnalysis({ avgGlucose: 139, lowPercentage: 4.1 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      expect(result.priority).toBe(InsightPriority.CRITICAL);
    });
  });

  describe('State C: Elevated (avg > 180)', () => {
    it('returns ALWAYS_INCLUDE priority and "higher than" text', () => {
      const analysis = createAnalysis({ avgGlucose: 250, lowPercentage: 0 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      expect(result.priority).toBe(InsightPriority.INFO); // INFO maps to ALWAYS_INCLUDE in types
      expect(result.note).toContain('higher than');
    });
  });

  describe('State D: Standard (avg 140-180 AND TBR <= 4%)', () => {
    it('returns ALWAYS_INCLUDE priority and "solid result" text', () => {
      const analysis = createAnalysis({ avgGlucose: 160, lowPercentage: 2 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      expect(result.priority).toBe(InsightPriority.INFO);
      expect(result.note).toContain('solid result');
    });

    it('handles boundary 140 mg/dL', () => {
      // Logic: avg 140-180. If avg is 140, it falls into D or E?
      // Spec:
      // ELSE IF avg 140-180 ... State D
      // ELSE (avg 70-140) ... State E
      // Usually "140-180" implies inclusive or exclusive.
      // Let's assume inclusive for upper bound of E or lower bound of D?
      // Spec says:
      // B: avg < 140
      // C: avg > 180
      // D: avg 140-180
      // E: avg 70-140
      // If avg is 140 exactly:
      // Not < 140. Not > 180.
      // So it's 140. Matches both ranges conceptually.
      // Let's look at code logic order:
      // if (avg < 70) ...
      // else if (avg < 140 && tbr > 4) ...
      // else if (avg > 180) ...
      // else if (avg >= 140) ... (Implied D)
      // else ... (Implied E)

      // If I implement `else if (avg >= 140)` for D, then 140 is D.
      // If I implement E as `else`, then < 140 is E.

      const analysis = createAnalysis({ avgGlucose: 140, lowPercentage: 4.0 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      // Based on "solid result" vs "optimal", 140 is usually "standard" or "elevated" depending on strictness.
      // Spec gate T6 says: 140 | 4.0 | D (Standard)
      expect(result.priority).toBe(InsightPriority.INFO);
      expect(result.note).toContain('solid result');
    });
  });

  describe('State E: Optimal (avg 70-140 AND TBR <= 4%)', () => {
    it('returns ALWAYS_INCLUDE priority and "fantastic" text', () => {
      const analysis = createAnalysis({ avgGlucose: 110, lowPercentage: 1 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();

      expect(result.priority).toBe(InsightPriority.INFO);
      expect(result.note).toContain('fantastic');
    });
  });

  describe('Formatting', () => {
    it('formats numbers correctly for mg/dL', () => {
      const analysis = createAnalysis({ avgGlucose: 100, lowPercentage: 0 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MGDL);
      const result = generator.generate();
      expect(result.note).toContain('100');
    });

    it('formats numbers correctly for mmol/L', () => {
      // 100 mg/dL / 18 = 5.55... -> 5.6
      const analysis = createAnalysis({ avgGlucose: 100, lowPercentage: 0 });
      const generator = createAvgGlucoseInsight(analysis, UNIT_MMOL);
      const result = generator.generate();
      expect(result.note).toContain('5.6');
    });
  });
});
