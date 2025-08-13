import {
  timestampToMinutesOfDay,
  minutesToTimeString,
  circularTimeDistance,
  calculateClusterCenterTime,
  calculateTimeRange,
  clusterGlycemicEvents,
  analyzeGlycemicEventTimes,
} from './time_clustering';
import { GlycemicEvent, GlycemicEventType } from '../detect_events';

describe('Time Clustering Utils', () => {
  // Sample timestamps for testing
  const timestamps = {
    midnight: '2023-05-01T00:00:00Z',
    oneAM: '2023-05-01T01:00:00Z',
    threeAM: '2023-05-01T03:00:00Z',
    elevenPM: '2023-05-01T23:00:00Z',
    elevenThirtyPM: '2023-05-01T23:30:00Z',
    twelveFifteenAM: '2023-05-02T00:15:00Z',
  };

  // Sample glycemic events for testing
  const createEvent = (type: GlycemicEventType, startTime: string, endTime: string): GlycemicEvent => ({
    event_type: type,
    start_timestamp: startTime,
    end_timestamp: endTime,
    duration_minutes: 15, // Arbitrary value for testing
    extreme_bg_mgdl: 65, // Arbitrary value for testing
  });

  describe('timestampToMinutesOfDay', () => {
    it('should convert midnight to 0 minutes', () => {
      expect(timestampToMinutesOfDay(timestamps.midnight)).toBe(0);
    });

    it('should convert 1:00 AM to 60 minutes', () => {
      expect(timestampToMinutesOfDay(timestamps.oneAM)).toBe(60);
    });

    it('should convert 11:30 PM to 1410 minutes', () => {
      expect(timestampToMinutesOfDay(timestamps.elevenThirtyPM)).toBe(1410);
    });
  });

  describe('minutesToTimeString', () => {
    it('should format 0 minutes as 00:00', () => {
      expect(minutesToTimeString(0)).toBe('00:00');
    });

    it('should format 60 minutes as 01:00', () => {
      expect(minutesToTimeString(60)).toBe('01:00');
    });

    it('should format 1410 minutes as 23:30', () => {
      expect(minutesToTimeString(1410)).toBe('23:30');
    });

    it('should handle values greater than 1440', () => {
      expect(minutesToTimeString(1500)).toBe('01:00'); // 1500 mins = 25 hours = 01:00
    });

    it('should handle negative values', () => {
      expect(minutesToTimeString(-60)).toBe('23:00'); // -60 mins = -1 hour from midnight = 23:00
    });
  });

  describe('circularTimeDistance', () => {
    it('should calculate direct distance between times on same side of midnight', () => {
      // 1:00 to 3:00 = 120 minutes directly
      expect(circularTimeDistance(60, 180)).toBe(120);
    });

    it('should calculate wrap-around distance when it is shorter', () => {
      // 11:00 PM (1380 mins) to 1:00 AM (60 mins)
      // Direct: 1380 - 60 = 1320 minutes
      // Wrap-around: 1440 - 1320 = 120 minutes (shorter)
      expect(circularTimeDistance(1380, 60)).toBe(120);
    });

    it('should handle identical times', () => {
      expect(circularTimeDistance(60, 60)).toBe(0);
    });
  });

  describe('calculateClusterCenterTime', () => {
    it('should return 0 for empty array', () => {
      expect(calculateClusterCenterTime([])).toBe(0);
    });

    it('should return the time for a single event', () => {
      const events = [createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.oneAM, timestamps.oneAM)];
      expect(calculateClusterCenterTime(events)).toBe(60); // 1:00 AM = 60 minutes
    });

    it('should calculate correct mean for times on same side of midnight', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.oneAM, timestamps.oneAM),
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.threeAM, timestamps.threeAM),
      ];
      expect(calculateClusterCenterTime(events)).toBe(120); // 2:00 AM = 120 minutes (mean of 1AM and 3AM)
    });

    it('should handle times that wrap around midnight', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.elevenThirtyPM, timestamps.elevenThirtyPM), // 23:30 = 1410 mins
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.twelveFifteenAM, timestamps.twelveFifteenAM), // 00:15 = 15 mins
      ];

      // Should be around 11:52 PM or 00:08 AM depending on exact implementation
      // The main point is it should be close to midnight, not around noon
      const result = calculateClusterCenterTime(events);

      // Verify it's within a reasonable range (close to midnight)
      const isNearMidnight =
        (result >= 1380 && result <= 1440) || // 11:00 PM to midnight
        (result >= 0 && result <= 60); // midnight to 1:00 AM

      expect(isNearMidnight).toBeTruthy();
    });
  });

  describe('calculateTimeRange', () => {
    it('should return 0, 0 for empty array', () => {
      expect(calculateTimeRange([])).toEqual({ earliest: 0, latest: 0 });
    });

    it('should return same time for single event', () => {
      const events = [createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.oneAM, timestamps.oneAM)];
      expect(calculateTimeRange(events)).toEqual({ earliest: 60, latest: 60 });
    });

    it('should find correct range for times on same side of midnight', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.oneAM, timestamps.oneAM),
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.threeAM, timestamps.threeAM),
      ];
      expect(calculateTimeRange(events)).toEqual({ earliest: 60, latest: 180 });
    });

    it('should find smallest range for times that wrap around midnight', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.elevenThirtyPM, timestamps.elevenThirtyPM), // 23:30
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.twelveFifteenAM, timestamps.twelveFifteenAM), // 00:15
      ];

      const result = calculateTimeRange(events);

      // The range should be 11:30 PM to 12:15 AM, not 12:15 AM to 11:30 PM
      // This is 45 minutes, not 23 hours and 15 minutes
      expect(result).toEqual({ earliest: 1410, latest: 15 });
    });
  });

  describe('clusterGlycemicEvents', () => {
    it('should return empty array for empty input', () => {
      expect(clusterGlycemicEvents([], 30)).toEqual([]);
    });

    it('should create single cluster for single event', () => {
      const events = [createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.oneAM, timestamps.oneAM)];

      const clusters = clusterGlycemicEvents(events, 30);

      expect(clusters.length).toBe(1);
      expect(clusters[0].count).toBe(1);
      expect(clusters[0].meanTime).toBe(60); // 1:00 AM
    });

    it('should cluster events within threshold', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:00:00Z', '2023-05-01T01:15:00Z'),
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:25:00Z', '2023-05-01T01:40:00Z'),
      ];

      // With 30 minute threshold, these should be clustered
      const clusters = clusterGlycemicEvents(events, 30);

      expect(clusters.length).toBe(1);
      expect(clusters[0].count).toBe(2);
    });

    it('should create separate clusters for events beyond threshold', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:00:00Z', '2023-05-01T01:15:00Z'),
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:45:00Z', '2023-05-01T02:00:00Z'),
      ];

      // With 30 minute threshold, these should be separate clusters
      const clusters = clusterGlycemicEvents(events, 30);

      expect(clusters.length).toBe(2);
      expect(clusters[0].count).toBe(1);
      expect(clusters[1].count).toBe(1);
    });

    it('should handle events around midnight correctly', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.elevenThirtyPM, timestamps.elevenThirtyPM), // 23:30
        createEvent(GlycemicEventType.HYPOGLYCEMIA, timestamps.twelveFifteenAM, timestamps.twelveFifteenAM), // 00:15
      ];

      // With 60 minute threshold, these should cluster despite being on different sides of midnight
      const clusters = clusterGlycemicEvents(events, 60);

      expect(clusters.length).toBe(1);
      expect(clusters[0].count).toBe(2);
    });

    it('should separate clusters by event type', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:00:00Z', '2023-05-01T01:15:00Z'),
        createEvent(GlycemicEventType.HYPERGLYCEMIA, '2023-05-01T01:05:00Z', '2023-05-01T01:20:00Z'),
      ];

      // Despite close times, these should be separate clusters due to different event types
      const clusters = clusterGlycemicEvents(events, 30);

      expect(clusters.length).toBe(2);
      expect(clusters[0].eventType).not.toBe(clusters[1].eventType);
    });
  });

  describe('analyzeGlycemicEventTimes', () => {
    it('should filter clusters by minimum events count', () => {
      const events = [
        // Cluster 1: 2 events
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:00:00Z', '2023-05-01T01:15:00Z'),
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:20:00Z', '2023-05-01T01:35:00Z'),

        // Cluster 2: 1 event
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T15:00:00Z', '2023-05-01T15:15:00Z'),

        // Cluster 3: 3 events
        createEvent(GlycemicEventType.HYPERGLYCEMIA, '2023-05-01T19:00:00Z', '2023-05-01T19:15:00Z'),
        createEvent(GlycemicEventType.HYPERGLYCEMIA, '2023-05-01T19:15:00Z', '2023-05-01T19:30:00Z'),
        createEvent(GlycemicEventType.HYPERGLYCEMIA, '2023-05-01T19:25:00Z', '2023-05-01T19:40:00Z'),
      ];

      // With minEventsPerCluster = 2, should return 2 clusters (clusters 1 and 3)
      const clusters = analyzeGlycemicEventTimes(events, { minEventsPerCluster: 2 });

      expect(clusters.length).toBe(2);
      expect(clusters[0].count).toBeGreaterThanOrEqual(2);
      expect(clusters[1].count).toBeGreaterThanOrEqual(2);
    });

    it('should use default options if not provided', () => {
      const events = [
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:00:00Z', '2023-05-01T01:15:00Z'),
        createEvent(GlycemicEventType.HYPOGLYCEMIA, '2023-05-01T01:20:00Z', '2023-05-01T01:35:00Z'),
      ];

      // Should use default proximityThreshold of 30
      const clusters = analyzeGlycemicEventTimes(events);

      expect(clusters.length).toBe(1);
      expect(clusters[0].count).toBe(2);
    });
  });
});
