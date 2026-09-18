import { describe, it, expect } from 'vitest';
import {
  triageClusters,
  scoreClusterSeverity,
} from '../../../src/lib/analysis/ClusterTriage.js';
import { GlycemicCluster } from '@goodnumbers/types';

describe('ClusterTriage Engine', () => {
  const createMockCluster = (
    overrides: Partial<GlycemicCluster>,
  ): GlycemicCluster => ({
    id: 'cluster-1',
    type: 'hyper',
    avgStartMinute: 14 * 60, // 2:00 PM
    avgDurationMinutes: 120,
    eventCount: 3,
    activeDays: [1, 2, 3],
    events: [
      {
        id: 'ev-1',
        type: overrides.type || 'hyper',
        startTime: '2026-09-15T14:00:00Z',
        endTime: '2026-09-15T16:00:00Z',
        startMinuteOfDay: 14 * 60,
        durationMinutes: 120,
        readings: [
          {
            timestamp: '2026-09-15T14:00:00Z',
            value: overrides.type === 'hypo' ? 65 : 210,
          },
          {
            timestamp: '2026-09-15T15:00:00Z',
            value: overrides.type === 'hypo' ? 52 : 260,
          },
        ],
      },
    ],
    ...overrides,
  });

  it('should rank severe hypoglycemia (glucose < 54 mg/dL) higher than mild hypoglycemia and hyperglycemia', () => {
    const severeHypo = createMockCluster({
      id: 'severe-hypo',
      type: 'hypo',
      eventCount: 2,
      events: [
        {
          id: 'ev-hypo-severe',
          type: 'hypo',
          startTime: '2026-09-15T03:00:00Z',
          endTime: '2026-09-15T04:00:00Z',
          startMinuteOfDay: 3 * 60,
          durationMinutes: 60,
          readings: [{ timestamp: '2026-09-15T03:30:00Z', value: 48 }],
        },
      ],
    });

    const mildHyper = createMockCluster({
      id: 'mild-hyper',
      type: 'hyper',
      eventCount: 4,
      events: [
        {
          id: 'ev-hyper',
          type: 'hyper',
          startTime: '2026-09-15T13:00:00Z',
          endTime: '2026-09-15T15:00:00Z',
          startMinuteOfDay: 13 * 60,
          durationMinutes: 120,
          readings: [{ timestamp: '2026-09-15T14:00:00Z', value: 200 }],
        },
      ],
    });

    const result = triageClusters([mildHyper, severeHypo]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('severe-hypo');
    expect(result[0].isPrimaryFocus).toBe(true);
    expect(result[1].id).toBe('mild-hyper');
    expect(result[1].isPrimaryFocus).toBe(false);
  });

  it('should flag nocturnal hypoglycemia with high priority bonus', () => {
    const nocturnalHypo = createMockCluster({
      id: 'night-hypo',
      type: 'hypo',
      avgStartMinute: 3 * 60, // 3:00 AM
      eventCount: 2,
    });

    const dayHypo = createMockCluster({
      id: 'day-hypo',
      type: 'hypo',
      avgStartMinute: 15 * 60, // 3:00 PM
      eventCount: 2,
    });

    const scoreNight = scoreClusterSeverity(nocturnalHypo);
    const scoreDay = scoreClusterSeverity(dayHypo);
    expect(scoreNight).toBeGreaterThan(scoreDay);
  });

  it('should return an empty array if empty array is passed', () => {
    const result = triageClusters([]);
    expect(result).toEqual([]);
  });

  it('should pick the single cluster when only 1 cluster is passed', () => {
    const single = createMockCluster({ id: 'only-one' });
    const result = triageClusters([single]);
    expect(result).toHaveLength(1);
    expect(result[0].isPrimaryFocus).toBe(true);
  });
});
