import { GlycemicEvent, GlycemicEventType } from '../detect_events';

/**
 * Interface representing a cluster of glycemic events that occur at similar times
 */
export interface TimeCluster {
  /** The glycemic events in this cluster */
  events: GlycemicEvent[];

  /** The type of glycemic event in this cluster */
  eventType: GlycemicEventType;

  /** The center/mean time of this cluster in minutes from midnight (0-1439) */
  meanTime: number;

  /** The time range of events in this cluster */
  startTimeRange: {
    /** Earliest time in the cluster in minutes from midnight (0-1439) */
    earliest: number;

    /** Latest time in the cluster in minutes from midnight (0-1439) */
    latest: number;
  };

  /** Number of events in this cluster */
  count: number;
}

/**
 * Converts an ISO timestamp to minutes of day (0-1439)
 *
 * @param timestamp - ISO8601 timestamp string
 * @returns Minutes since midnight (0-1439)
 */
export function timestampToMinutesOfDay(timestamp: string): number {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Formats minutes of day back to a time string (HH:MM)
 *
 * @param minutes - Minutes since midnight (0-1439)
 * @returns Formatted time string (HH:MM)
 */
export function minutesToTimeString(minutes: number): string {
  // Ensure minutes is within 0-1439 range
  minutes = ((minutes % 1440) + 1440) % 1440;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  // Format with leading zeros
  const hoursStr = hours.toString().padStart(2, '0');
  const minsStr = mins.toString().padStart(2, '0');

  return `${hoursStr}:${minsStr}`;
}

/**
 * Calculates the circular distance between two times of day
 * This accounts for the circular nature of time (e.g., 23:59 is close to 00:01)
 *
 * @param time1 - First time in minutes from midnight (0-1439)
 * @param time2 - Second time in minutes from midnight (0-1439)
 * @returns The shortest distance in minutes between the two times
 */
export function circularTimeDistance(time1: number, time2: number): number {
  // Ensure both times are in the 0-1439 range
  time1 = ((time1 % 1440) + 1440) % 1440;
  time2 = ((time2 % 1440) + 1440) % 1440;

  // Calculate direct distance
  const directDistance = Math.abs(time1 - time2);

  // Calculate wrap-around distance (going the other way around the clock)
  const wrapAroundDistance = 1440 - directDistance;

  // Return the shorter of the two distances
  return Math.min(directDistance, wrapAroundDistance);
}

/**
 * Calculates the center time for a cluster of events
 * Uses circular mean to handle the circular nature of time
 *
 * @param events - Array of glycemic events
 * @returns Mean time in minutes from midnight (0-1439)
 */
export function calculateClusterCenterTime(events: GlycemicEvent[]): number {
  if (events.length === 0) {
    return 0;
  }

  if (events.length === 1) {
    return timestampToMinutesOfDay(events[0].start_timestamp);
  }

  // Convert each time to an angle on the unit circle (in radians)
  // 0 minutes = 0 radians, 1440 minutes (24h) = 2π radians
  const angles = events.map((event) => {
    const minutesOfDay = timestampToMinutesOfDay(event.start_timestamp);
    return (minutesOfDay / 1440) * 2 * Math.PI;
  });

  // Calculate the sum of the x and y components on the unit circle
  let sumX = 0;
  let sumY = 0;

  for (const angle of angles) {
    sumX += Math.cos(angle);
    sumY += Math.sin(angle);
  }

  // Calculate the average angle
  const avgX = sumX / events.length;
  const avgY = sumY / events.length;

  // Convert back to an angle
  let averageAngle = Math.atan2(avgY, avgX);

  // Ensure the result is in the range [0, 2π)
  if (averageAngle < 0) {
    averageAngle += 2 * Math.PI;
  }

  // Convert back to minutes of day (0-1439)
  return Math.round((averageAngle / (2 * Math.PI)) * 1440);
}

/**
 * Calculates the smallest continuous time range that contains all events
 * Accounts for the circular nature of time (e.g., 11:30 PM to 12:30 AM)
 *
 * @param events - Array of glycemic events
 * @returns Object containing earliest and latest times in minutes from midnight
 */
export function calculateTimeRange(events: GlycemicEvent[]): { earliest: number; latest: number } {
  if (events.length === 0) {
    return { earliest: 0, latest: 0 };
  }

  if (events.length === 1) {
    const time = timestampToMinutesOfDay(events[0].start_timestamp);
    return { earliest: time, latest: time };
  }

  // Extract start times in minutes of day
  const minutesOfDay = events.map((event) => timestampToMinutesOfDay(event.start_timestamp));

  // Find the smallest continuous arc that contains all times
  // This requires special handling due to circular nature of time

  let smallestRange = 1440; // Initialize with maximum possible range (24 hours)
  let earliestTime = 0;
  let latestTime = 0;

  // Try each time as a potential starting point of the range
  for (let i = 0; i < minutesOfDay.length; i++) {
    // Create a circular arrangement starting from index i
    const times: number[] = [];
    for (let j = 0; j < minutesOfDay.length; j++) {
      // Get index in circular fashion
      const idx = (i + j) % minutesOfDay.length;
      times.push(minutesOfDay[idx]);
    }

    // Adjust times that wrap around midnight by adding 24 hours (1440 minutes)
    // This converts circular time to linear time temporarily
    for (let j = 1; j < times.length; j++) {
      if (times[j] < times[0]) {
        times[j] += 1440;
      }
    }

    // Calculate range from first to last time in this arrangement
    const currentRange = times[times.length - 1] - times[0];

    // Update if this arrangement gives a smaller range
    if (currentRange < smallestRange) {
      smallestRange = currentRange;
      earliestTime = times[0] % 1440;
      latestTime = times[times.length - 1] % 1440;
    }
  }

  return { earliest: earliestTime, latest: latestTime };
}

/**
 * Clusters glycemic events by similar times of day
 * Groups events that occur within a specified time threshold of each other
 * Handles the circular nature of time (midnight wrapping)
 *
 * @param events - Array of glycemic events to cluster
 * @param proximityThresholdMinutes - Maximum time difference (in minutes) to consider events part of the same cluster
 * @returns Array of time clusters
 */
export function clusterGlycemicEvents(events: GlycemicEvent[], proximityThresholdMinutes: number): TimeCluster[] {
  if (events.length === 0) {
    return [];
  }

  // Convert timestamps to minutes-of-day for easier clustering
  const eventsWithMinutes = events.map((event) => ({
    ...event,
    startMinutesOfDay: timestampToMinutesOfDay(event.start_timestamp),
  }));

  // Sort events by minutes-of-day for more efficient clustering
  const sortedEvents = [...eventsWithMinutes].sort((a, b) => a.startMinutesOfDay - b.startMinutesOfDay);

  // Initialize clusters array
  const clusters: TimeCluster[] = [];

  // Process each event
  for (const event of sortedEvents) {
    // Check if this event fits into an existing cluster
    let foundCluster = false;

    for (const cluster of clusters) {
      // Skip clusters that don't match the event type
      if (cluster.eventType !== event.event_type) {
        continue;
      }

      // Calculate distance to cluster center
      const clusterTime = cluster.meanTime;
      const distance = circularTimeDistance(event.startMinutesOfDay, clusterTime);

      // If within threshold, add to this cluster
      if (distance <= proximityThresholdMinutes) {
        cluster.events.push(event);
        // Recalculate cluster statistics
        cluster.meanTime = calculateClusterCenterTime(cluster.events);
        cluster.startTimeRange = calculateTimeRange(cluster.events);
        cluster.count = cluster.events.length;
        foundCluster = true;
        break;
      }
    }

    // If no suitable cluster found, create a new one
    if (!foundCluster) {
      clusters.push({
        events: [event],
        eventType: event.event_type,
        meanTime: event.startMinutesOfDay,
        startTimeRange: {
          earliest: event.startMinutesOfDay,
          latest: event.startMinutesOfDay,
        },
        count: 1,
      });
    }
  }

  return clusters;
}

/**
 * Analyzes glycemic events to find patterns at similar times
 * Main entry point for time-based clustering functionality
 *
 * @param events - Array of glycemic events to analyze
 * @param options - Configuration options for the analysis
 * @returns Array of time clusters representing patterns
 */
export function analyzeGlycemicEventTimes(
  events: GlycemicEvent[],
  options: {
    proximityThreshold?: number;
    minEventsPerCluster?: number;
  } = {},
): TimeCluster[] {
  // Default options
  const proximityThreshold = options.proximityThreshold ?? 30; // 30 minutes by default
  const minEventsPerCluster = options.minEventsPerCluster ?? 2; // At least 2 events to consider a pattern

  // Perform time-based clustering
  const allClusters = clusterGlycemicEvents(events, proximityThreshold);

  // Filter clusters by minimum number of events
  return allClusters.filter((cluster) => cluster.count >= minEventsPerCluster);
}
