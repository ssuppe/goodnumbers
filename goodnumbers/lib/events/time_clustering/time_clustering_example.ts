import { GlycemicEvent, GlycemicEventType } from '../detect_events';
import { analyzeGlycemicEventTimes, TimeCluster, minutesToTimeString } from '../time_clustering';

/**
 * Example showing how to use the time clustering functionality
 * This demonstrates how to group glycemic events by time
 * and generate human-readable insights
 */

// Sample glycemic events data (normally this would come from the detectGlycemicEvents function)
const sampleEvents: GlycemicEvent[] = [
  // Morning lows around 2:30 AM
  {
    event_type: GlycemicEventType.HYPOGLYCEMIA,
    start_timestamp: '2023-05-01T02:24:00Z',
    end_timestamp: '2023-05-01T02:45:00Z',
    duration_minutes: 21,
    extreme_bg_mgdl: 62,
  },
  {
    event_type: GlycemicEventType.HYPOGLYCEMIA,
    start_timestamp: '2023-05-02T02:37:00Z',
    end_timestamp: '2023-05-02T03:15:00Z',
    duration_minutes: 38,
    extreme_bg_mgdl: 58,
  },
  {
    event_type: GlycemicEventType.HYPOGLYCEMIA,
    start_timestamp: '2023-05-03T02:15:00Z',
    end_timestamp: '2023-05-03T02:40:00Z',
    duration_minutes: 25,
    extreme_bg_mgdl: 65,
  },

  // Evening highs around 7:00 PM
  {
    event_type: GlycemicEventType.HYPERGLYCEMIA,
    start_timestamp: '2023-05-01T19:05:00Z',
    end_timestamp: '2023-05-01T20:00:00Z',
    duration_minutes: 55,
    extreme_bg_mgdl: 210,
  },
  {
    event_type: GlycemicEventType.HYPERGLYCEMIA,
    start_timestamp: '2023-05-02T18:55:00Z',
    end_timestamp: '2023-05-02T19:45:00Z',
    duration_minutes: 50,
    extreme_bg_mgdl: 225,
  },

  // Random isolated events (shouldn't cluster)
  {
    event_type: GlycemicEventType.HYPERGLYCEMIA,
    start_timestamp: '2023-05-03T12:00:00Z',
    end_timestamp: '2023-05-03T12:30:00Z',
    duration_minutes: 30,
    extreme_bg_mgdl: 195,
  },
  {
    event_type: GlycemicEventType.HYPOGLYCEMIA,
    start_timestamp: '2023-05-03T15:20:00Z',
    end_timestamp: '2023-05-03T15:40:00Z',
    duration_minutes: 20,
    extreme_bg_mgdl: 68,
  },
];

/**
 * Function to generate a human-readable description of a time cluster
 *
 * @param cluster - The time cluster to describe
 * @returns A human-readable string describing the cluster
 */
function generateClusterDescription(cluster: TimeCluster): string {
  // Format the time information
  const meanTimeStr = minutesToTimeString(cluster.meanTime);

  // Format the earliest and latest times
  const earliestTimeStr = minutesToTimeString(cluster.startTimeRange.earliest);
  const latestTimeStr = minutesToTimeString(cluster.startTimeRange.latest);

  // Get the event type description
  const eventTypeStr = cluster.eventType === GlycemicEventType.HYPOGLYCEMIA ? 'low blood sugar' : 'high blood sugar';

  // Check if it's a recurring pattern (more than one event)
  if (cluster.count > 1) {
    return (
      `You had ${cluster.count} ${eventTypeStr} events around ${meanTimeStr} ` +
      `(between ${earliestTimeStr} and ${latestTimeStr})`
    );
  } else {
    return `You had a ${eventTypeStr} event at ${meanTimeStr}`;
  }
}

/**
 * Main example function showing how to use time clustering
 */
function runExample(): void {
  console.log('Analyzing glycemic events for patterns...');

  // Analyze the events with default options (30-minute threshold, 2+ events per cluster)
  const timeClusters = analyzeGlycemicEventTimes(sampleEvents);

  console.log(`Found ${timeClusters.length} recurring patterns:`);

  // Generate and print descriptions for each cluster
  timeClusters.forEach((cluster, index) => {
    console.log(`Pattern ${index + 1}: ${generateClusterDescription(cluster)}`);

    // Print details about each event in the cluster
    console.log('  Events in this pattern:');
    cluster.events.forEach((event) => {
      // Extract just the time portion from the ISO timestamp for readability
      const timeStr = new Date(event.start_timestamp).toISOString().substr(11, 5);
      console.log(
        `  - ${timeStr} on ${new Date(event.start_timestamp).toISOString().substr(0, 10)}, ` +
          `${event.duration_minutes} minutes, ${event.extreme_bg_mgdl} mg/dL`,
      );
    });
    console.log('');
  });

  // Example of how to adjust the clustering parameters
  console.log('Analyzing with a smaller time threshold (15 minutes):');
  const tighterClusters = analyzeGlycemicEventTimes(sampleEvents, {
    proximityThreshold: 15,
    minEventsPerCluster: 2,
  });

  console.log(`Found ${tighterClusters.length} recurring patterns with tighter grouping`);

  // Example of finding all clusters, even single events
  console.log('Finding all events, including non-recurring ones:');
  const allClusters = analyzeGlycemicEventTimes(sampleEvents, {
    minEventsPerCluster: 1,
  });

  console.log(`Total of ${allClusters.length} events/patterns`);
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}

// Export for potential use in other examples
export { runExample, generateClusterDescription };
