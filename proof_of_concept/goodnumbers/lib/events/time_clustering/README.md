# Time-Based Clustering for Glycemic Events

This module provides functionality to analyze and detect patterns in glycemic events by clustering them based on the time of day they occur.

## Purpose

For people with Type 1 Diabetes, recognizing patterns in blood glucose levels is crucial for optimizing treatment. This implementation specifically helps identify recurring patterns like:

- "You tend to go low around 2:30 AM several times this week"
- "You have high blood sugars consistently around dinner time"

These patterns help users make informed adjustments to their insulin dosing, meal timing, and other aspects of diabetes management.

## Key Features

- Groups events that occur at similar times of day
- Handles the circular nature of time (e.g., 11:45 PM is close to 12:15 AM)
- Calculates meaningful statistics for each cluster (mean time, time range)
- Filters out one-off events to focus on recurring patterns

## Implementation Details

The implementation addresses several challenges specific to time-based clustering:

### Circular Time Handling

Time is circular (midnight wraps around to the start of the day), requiring special handling:

- `circularTimeDistance`: Calculates the shortest distance between two times, considering both direct and wrap-around paths
- `calculateClusterCenterTime`: Uses circular mean calculation to find the center time of a cluster
- `calculateTimeRange`: Finds the smallest arc containing all times in a cluster

### Smart Clustering

The clustering algorithm:
1. Converts timestamps to minutes-of-day for easier comparison
2. Groups events that occur within a configurable proximity threshold
3. Maintains separate clusters for different event types (low vs. high)
4. Dynamically recalculates cluster statistics as events are added

## Usage

```typescript
import { detectGlycemicEvents } from './detect_events';
import { analyzeGlycemicEventTimes, minutesToTimeString } from './time_clustering';

// Get glycemic events from data
const events = detectGlycemicEvents(glucoseData);

// Analyze for time-based patterns (default: 30-minute threshold, 2+ events per cluster)
const timeClusters = analyzeGlycemicEventTimes(events);

// Display patterns to the user
timeClusters.forEach(cluster => {
  const meanTimeStr = minutesToTimeString(cluster.meanTime);
  console.log(`${cluster.count} ${cluster.eventType} events around ${meanTimeStr}`);
});
```

See `time_clustering_example.ts` for a complete usage example.

## Configuration Options

When calling `analyzeGlycemicEventTimes`, you can customize the analysis:

```typescript
const clusters = analyzeGlycemicEventTimes(events, {
  proximityThreshold: 15,  // Group events within 15 minutes (default: 30)
  minEventsPerCluster: 3   // Only show patterns with 3+ events (default: 2)
});
```

## API Reference

### Main Functions

- `analyzeGlycemicEventTimes`: Main entry point for time-based clustering
- `clusterGlycemicEvents`: Core clustering algorithm
- `calculateClusterCenterTime`: Calculates mean time for a cluster
- `calculateTimeRange`: Finds the smallest time range containing all events

### Utility Functions

- `timestampToMinutesOfDay`: Converts ISO timestamp to minutes since midnight
- `minutesToTimeString`: Formats minutes-of-day as a readable time string
- `circularTimeDistance`: Calculates the shortest distance between two times

### Types

- `TimeCluster`: Represents a group of events occurring at similar times
