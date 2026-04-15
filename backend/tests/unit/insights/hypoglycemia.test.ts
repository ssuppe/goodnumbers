import { describe, it, expect } from 'vitest';
import { createHypoglycemiaInsight } from '../../../src/lib/insights/hypoglycemia.js';
import { InsightPriority } from '@goodnumbers/types';

describe('HypoglycemiaInsightGenerator', () => {
  it('should return Optimal state for TBR < 1%', () => {
    const insight = createHypoglycemiaInsight(0.5).generate();
    expect(insight.priority).toBe(InsightPriority.INFO);
    expect(insight.note).toContain('Celebrate the Win');
    expect(insight.note).toContain('near-total avoidance of lows');
  });

  it('should return Target state for TBR 1% - 4%', () => {
    // Boundary check: 1.0
    let insight = createHypoglycemiaInsight(1.0).generate();
    expect(insight.priority).toBe(InsightPriority.IMPORTANT);
    expect(insight.note).toContain('Stay the Course');

    // Boundary check: 4.0
    insight = createHypoglycemiaInsight(4.0).generate();
    expect(insight.priority).toBe(InsightPriority.IMPORTANT);
    expect(insight.note).toContain('Stay the Course');
  });

  it('should return Elevated state for TBR > 4% - < 10%', () => {
    // Boundary check: 4.1
    let insight = createHypoglycemiaInsight(4.1).generate();
    expect(insight.priority).toBe(InsightPriority.SERIOUS);
    expect(insight.note).toContain('Prioritize Safety');

    // Boundary check: 9.9
    insight = createHypoglycemiaInsight(9.9).generate();
    expect(insight.priority).toBe(InsightPriority.SERIOUS);
    expect(insight.note).toContain('hypo unawareness');
  });

  it('should return Critical state for TBR >= 10%', () => {
    // Boundary check: 10.0
    let insight = createHypoglycemiaInsight(10.0).generate();
    expect(insight.priority).toBe(InsightPriority.CRITICAL);
    expect(insight.note).toContain('Medical Urgent');

    // Extreme case
    insight = createHypoglycemiaInsight(25.0).generate();
    expect(insight.priority).toBe(InsightPriority.CRITICAL);
    expect(insight.note).toContain('severe threat');
  });
});
