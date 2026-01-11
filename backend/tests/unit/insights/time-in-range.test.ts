import { describe, it, expect } from 'vitest';
import { createTimeInRangeInsight } from '../../../src/lib/insights/time-in-range.js';
import { InsightPriority } from '@goodnumbers/types';

describe('TimeInRangeInsightGenerator', () => {
  it('should return High Burden state for TIR < 50%', () => {
    const insight = createTimeInRangeInsight(49.9).generate();
    expect(insight.priority).toBe(InsightPriority.IMPORTANT);
    expect(insight.note).toContain('Focus on the Foundation');
    expect(insight.note).toContain(
      'spending over half your time outside of target',
    );
  });

  it('should return Building Stability state for TIR 50% - < 70%', () => {
    // Boundary check: 50.0
    let insight = createTimeInRangeInsight(50.0).generate();
    expect(insight.priority).toBe(InsightPriority.IMPORTANT);
    expect(insight.note).toContain('Making Progress');

    // Boundary check: 69.9
    insight = createTimeInRangeInsight(69.9).generate();
    expect(insight.priority).toBe(InsightPriority.IMPORTANT);
    expect(insight.note).toContain('Making Progress');
  });

  it('should return On Target state for TIR 70% - 85%', () => {
    // Boundary check: 70.0
    let insight = createTimeInRangeInsight(70.0).generate();
    expect(insight.priority).toBe(InsightPriority.INFO);
    expect(insight.note).toContain('Goal Reached');
    expect(insight.note).toContain('Gold Standard');

    // Boundary check: 85.0
    insight = createTimeInRangeInsight(85.0).generate();
    expect(insight.priority).toBe(InsightPriority.INFO);
    expect(insight.note).toContain('Goal Reached');
  });

  it('should return Mastery state for TIR > 85%', () => {
    // Boundary check: 85.1
    const insight = createTimeInRangeInsight(85.1).generate();
    expect(insight.priority).toBe(InsightPriority.INFO);
    expect(insight.note).toContain('Outstanding Results');
    expect(insight.note).toContain('mental health');
  });
});
