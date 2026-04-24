import { describe, it, expect } from 'vitest';
import { generateClusterInsights } from '@src/lib/insights/cluster';
import {
  InsightPriority,
  type GlycemicCluster,
  type GlycemicEvent,
} from '@goodnumbers/types';

describe('Cluster Insights', () => {
  const mockEvents: GlycemicEvent[] = [
    {
      id: 'e1',
      type: 'hyper',
      startTime: '2023-01-01T12:00:00Z',
      endTime: '2023-01-01T13:00:00Z',
      startMinuteOfDay: 720,
      durationMinutes: 60,
      readings: [],
    },
    {
      id: 'e2',
      type: 'hyper',
      startTime: '2023-01-02T12:00:00Z',
      endTime: '2023-01-02T13:00:00Z',
      startMinuteOfDay: 720,
      durationMinutes: 60,
      readings: [],
    },
  ];

  const mockCluster: GlycemicCluster = {
    id: 'c1',
    type: 'hyper',
    avgStartMinute: 720,
    avgDurationMinutes: 60,
    eventCount: 2,
    activeDays: [1, 2],
    events: mockEvents,
  };

  it('detects uncovered meal (Carbs > 0, Insulin = 0)', () => {
    const treatments = [
      {
        date: new Date('2023-01-01T11:30:00Z').getTime(), // 30 mins before first event
        carbs: 50,
        insulin: 0,
      },
      {
        date: new Date('2023-01-02T11:45:00Z').getTime(), // 15 mins before second event
        carbs: 30,
        insulin: 0,
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'Potential uncovered meals detected in 2 events (Sun 12:00 PM, Mon 12:00 PM)',
        ),
      }),
    );
  });

  it('ignores meals outside 3h lookback window', () => {
    const treatments = [
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
    // We don't use treatment notes in the output string, but let's ensure we don't crash
    const treatments = [
      {
        date: new Date('2023-01-01T11:30:00Z').getTime(),
        carbs: 50,
        insulin: 0,
        notes: '<script>alert(1)</script>',
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    // Ensure the note generated is standard static text, not dynamic
    expect(insights[0].note).not.toContain('<script>');
  });

  it('returns empty array if no events in cluster', () => {
    const insights = generateClusterInsights(
      { ...mockCluster, events: [] },
      [],
    );
    expect(insights).toEqual([]);
  });
});
