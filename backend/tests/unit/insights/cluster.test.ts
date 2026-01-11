import { describe, it, expect } from 'vitest';
import { generateClusterInsights } from '@src/lib/insights/cluster';
import { InsightPriority, type GlycemicCluster } from '@goodnumbers/types';

interface MockTreatment {
  date: number;
  carbs?: number;
  insulin?: number;
  notes?: string;
}

describe('Cluster Insights', () => {
  const mockCluster: GlycemicCluster = {
    id: 'test-cluster',
    type: 'hyper',
    avgStartMinute: 720, // 12:00 PM
    avgDurationMinutes: 60,
    eventCount: 1,
    activeDays: [1],
    events: [
      {
        id: 'e1',
        type: 'hyper',
        startTime: '2023-01-01T12:00:00Z',
        endTime: '2023-01-01T13:00:00Z',
        startMinuteOfDay: 720,
        durationMinutes: 60,
        readings: [],
      },
    ],
  };

  it('detects uncovered meal (Carbs > 0, Insulin = 0)', () => {
    const treatments: MockTreatment[] = [
      {
        date: new Date('2023-01-01T11:30:00Z').getTime(), // 30 mins before
        carbs: 50,
        insulin: 0,
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining('uncovered'),
      }),
    );
  });

  it('ignores meals outside 3h lookback window', () => {
    const treatments: MockTreatment[] = [
      {
        date: new Date('2023-01-01T08:00:00Z').getTime(), // 4 hours before
        carbs: 50,
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights).toHaveLength(0);
  });

  // SECURITY TEST
  it('sanitizes or ignores malicious input in treatment notes', () => {
    const treatments: MockTreatment[] = [
      {
        date: new Date('2023-01-01T11:30:00Z').getTime(),
        carbs: 50,
        insulin: 0,
        notes: '<script>alert(1)</script>',
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights[0].note).not.toContain('<script>');
  });
});
