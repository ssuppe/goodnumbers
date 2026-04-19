import { describe, it, expect } from 'vitest';
import { generateClusterInsights } from '@src/lib/insights/cluster';
import {
  InsightPriority,
  type GlycemicCluster,
  type GlycemicEvent,
} from '@goodnumbers/types';

describe('Cluster Bolus Timing Insights', () => {
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

  it('detects post-bolused meals (Insulin >= Meal - 5m)', () => {
    const treatments = [
      {
        date: new Date('2023-01-01T11:00:00Z').getTime(), // Meal at 11:00
        carbs: 50,
      },
      {
        date: new Date('2023-01-01T11:05:00Z').getTime(), // Bolus at 11:05 (Post-bolus because >= 11:00 - 5m)
        insulin: 5,
      },
      {
        date: new Date('2023-01-02T11:00:00Z').getTime(), // Meal at 11:00
        carbs: 30,
      },
      {
        date: new Date('2023-01-02T11:02:00Z').getTime(), // Bolus at 11:02 (Post-bolus)
        insulin: 3,
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        note: expect.stringContaining('100% of these high events'),
      }),
    );
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'Post-meal hyperglycemia detected in 2 events where insulin was given at or after eating',
        ),
      }),
    );
  });

  it('detects pre-bolused meals (Insulin < Meal - 5m)', () => {
    const treatments = [
      {
        date: new Date('2023-01-01T11:00:00Z').getTime(), // Meal at 11:00
        carbs: 50,
      },
      {
        date: new Date('2023-01-01T10:45:00Z').getTime(), // Bolus at 10:45 (Pre-bolus because < 11:00 - 5m)
        insulin: 5,
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          'Hyperglycemia occurred in 1 events despite insulin being given before the meal',
        ),
      }),
    );
  });

  it('detects mixed patterns in a cluster', () => {
    const treatments = [
      {
        date: new Date('2023-01-01T11:00:00Z').getTime(),
        carbs: 50, // Uncovered
      },
      {
        date: new Date('2023-01-02T11:00:00Z').getTime(),
        carbs: 30,
      },
      {
        date: new Date('2023-01-02T11:10:00Z').getTime(), // Post-bolus
        insulin: 3,
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    expect(insights).toHaveLength(3);
    expect(insights).toContainEqual(
      expect.objectContaining({
        note: expect.stringContaining('100% of these high events'),
      }),
    );
    expect(insights).toContainEqual(
      expect.objectContaining({
        note: expect.stringContaining(
          'Potential uncovered meals detected in 1 events',
        ),
      }),
    );
    expect(insights).toContainEqual(
      expect.objectContaining({
        note: expect.stringContaining(
          'Post-meal hyperglycemia detected in 1 events where insulin was given at or after eating (post-bolused)',
        ),
      }),
    );
  });

  it('does not generate meal insights for non-meal events', () => {
    const treatments = [
      {
        date: new Date('2023-01-01T10:00:00Z').getTime(),
        insulin: 5, // Correction bolus, no carbs
      },
    ];
    const insights = generateClusterInsights(mockCluster, treatments);
    // Should only have 0 insights (or at least no meal-related ones)
    expect(
      insights.filter((i) => i.note.toLowerCase().includes('meal')),
    ).toHaveLength(0);
  });
});
