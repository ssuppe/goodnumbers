'use client';

import React from 'react';
import { AssessmentInsight, GlucoseUnits, InsightPriority, NightscoutEntry, NightscoutTreatment } from '@/types/nightscout.d';
import { ClusterEventsChart } from './ClusterEventsChart';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconBulb,
  IconClock,
  IconRepeat,
} from '@tabler/icons-react';
import { TimeCluster, minutesToTimeString } from '@/lib/events/time_clustering/time_clustering';
import { GlycemicEventType } from '@/lib/events/detect_events';

interface ClusterAnalysisDisplayProps {
  entries: NightscoutEntry[];
  cluster: TimeCluster;
  units: GlucoseUnits;
  patientLowGoal?: number;
  patientHighGoal?: number;
  title?: string;
  description?: string;
  insights: AssessmentInsight[];
  treatments?: NightscoutTreatment[]; // Optional treatments data for meal events
}

/**
 * Helper function to get a friendly name for event type
 */
function getEventTypeName(eventType: GlycemicEventType): string {
  switch (eventType) {
    case GlycemicEventType.VERY_HIGH:
      return 'Very High Glucose';
    case GlycemicEventType.HIGH:
      return 'High Glucose';
    case GlycemicEventType.HYPOGLYCEMIA:
      return 'Low Glucose';
    case GlycemicEventType.SEVERE_HYPOGLYCEMIA:
      return 'Severe Low Glucose';
    default:
      return 'Unknown Event Type';
  }
}

/**
 * Component to display a cluster analysis with its chart and associated insights
 * Shows a summary of the cluster characteristics and plots each event
 * Events are aligned by time of day regardless of the actual date they occurred
 */
export function ClusterAnalysisDisplay({
  entries,
  cluster,
  units,
  patientLowGoal,
  patientHighGoal,
  title: title,
  description,
  insights,
  treatments,
}: ClusterAnalysisDisplayProps) {
  // Function to render the appropriate icon based on insight priority
  const renderPriorityIcon = (priority: InsightPriority) => {
    switch (priority) {
      case InsightPriority.CRITICAL:
        return <IconAlertCircle className="flex-shrink-0 w-5 h-5 text-red-500 mr-2" aria-hidden="true" />;
      case InsightPriority.SERIOUS:
        return <IconAlertTriangle className="flex-shrink-0 w-5 h-5 text-amber-500 mr-2" aria-hidden="true" />;
      case InsightPriority.IMPORTANT:
        return (
          <IconInfoCircle className="flex-shrink-0 w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" aria-hidden="true" />
        );
      case InsightPriority.ALWAYS_INCLUDE:
        return <IconBulb className="flex-shrink-0 w-5 h-5 text-blue-500 mr-2" aria-hidden="true" />;
      default:
        return (
          <span
            className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full mr-3 ml-1.5"
            aria-hidden="true"
          />
        );
    }
  };

  // Function to get accessible label for priority level (for screen readers)
  const getPriorityLabel = (priority: InsightPriority): string => {
    switch (priority) {
      case InsightPriority.CRITICAL:
        return 'Critical insight: ';
      case InsightPriority.SERIOUS:
        return 'Serious insight: ';
      case InsightPriority.IMPORTANT:
        return 'Important insight: ';
      case InsightPriority.ALWAYS_INCLUDE:
        return 'Key insight: ';
      default:
        return 'Insight: ';
    }
  };

  // Render a single insight with appropriate icon
  const renderInsight = (insight: AssessmentInsight, index: number) => {
    const priorityLabel = getPriorityLabel(insight.priority);

    return (
      <li
        key={index}
        className={`flex items-start py-2 ${
          insight.priority === InsightPriority.CRITICAL
            ? 'bg-red-50 dark:bg-red-950/20 px-3 rounded-md'
            : insight.priority === InsightPriority.SERIOUS
              ? 'bg-amber-50 dark:bg-amber-950/20 px-3 rounded-md'
              : ''
        }`}
      >
        {renderPriorityIcon(insight.priority)}
        <span>
          <span className="sr-only">{priorityLabel}</span>
          {insight.note}
        </span>
      </li>
    );
  };

  // Log cluster details for debugging (keeping this as is)
  // React.useEffect(() => {
  //   console.log('Cluster analysis data:', {
  //     eventType: cluster.eventType,
  //     count: cluster.count,
  //     meanTime: minutesToTimeString(cluster.meanTime),
  //     timeRange: {
  //       earliest: minutesToTimeString(cluster.startTimeRange.earliest),
  //       latest: minutesToTimeString(cluster.startTimeRange.latest),
  //     },
  //     events: cluster.events.map((e) => ({
  //       start: e.start_timestamp,
  //       end: e.end_timestamp,
  //       duration: e.duration_minutes,
  //       extreme: e.extreme_bg_mgdl,
  //     })),
  //   });
  // }, [cluster]);

  // Generate a cluster summary
  const clusterSummary = `${cluster.count} ${getEventTypeName(cluster.eventType)} events
    typically occur around ${minutesToTimeString(cluster.meanTime)} (between ${minutesToTimeString(cluster.startTimeRange.earliest)}
    and ${minutesToTimeString(cluster.startTimeRange.latest)})`;

  // Generate title if not provided
  const effectiveTitle = title || `${getEventTypeName(cluster.eventType)} Pattern Analysis`;

  return (
    <div className="mb-6 space-y-3">
      {' '}
      {/* Reduced bottom margin and spacing between sections */}
      {/* Title */}
      {effectiveTitle && <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">{effectiveTitle}</h3>}
      {/* Cluster summary section */}
      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        {' '}
        {/* Reduced padding in summary box */}
        <div className="flex space-x-4 mb-3">
          <div className="flex items-center">
            <IconClock className="w-5 h-5 mr-2 text-blue-500" />
            <span>
              <strong>Time of Day:</strong> {minutesToTimeString(cluster.meanTime)}
            </span>
          </div>
          <div className="flex items-center">
            <IconRepeat className="w-5 h-5 mr-2 text-green-500" />
            <span>
              <strong>Count:</strong> {cluster.count} events
            </span>
          </div>
        </div>
        {/* Reduced font size for the detailed summary */}
        <p className="text-sm text-gray-600 dark:text-gray-400">{clusterSummary}</p>
        {description && <p className="text-gray-600 dark:text-gray-400 mt-2">{description}</p>}
      </div>
      {/* Chart */}
      <div className="mt-3">
        {' '}
        {/* Reduced margin above chart */}
        <ClusterEventsChart
          cluster={cluster}
          entries={entries}
          units={units}
          patientLowGoal={patientLowGoal}
          patientHighGoal={patientHighGoal}
          title={`${getEventTypeName(cluster.eventType)} Events around ${minutesToTimeString(cluster.meanTime)}`}
          treatments={treatments}
        />
      </div>
      {/* Insights */}
      {/* Reduced margin above insights */}
      <div className="mt-4">
        {insights.length > 0 ? (
          <ul className="space-y-2" role="list" aria-label="Cluster insights">
            {insights.map(renderInsight)}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">No insights available for this cluster</p>
        )}
      </div>
    </div>
  );
}
