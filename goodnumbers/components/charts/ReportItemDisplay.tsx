'use client';

import React from 'react';
import { ReportItem, AssessmentInsight, InsightPriority, GlucoseUnits } from '@/types/nightscout';
import { AgpChart } from './AgpChart';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle, IconBulb } from '@tabler/icons-react';

interface ReportItemDisplayProps {
  reportItem: ReportItem;
  units: GlucoseUnits;
  patientLowGoal?: number;
  patientHighGoal?: number;
  title?: string;
  subtitle?: string;
  description?: string;
}

/**
 * Component to display a report item with its chart and associated insights
 * Insights are displayed with icons based on their priority level
 */
export function ReportItemDisplay({
  reportItem,
  units,
  patientLowGoal,
  patientHighGoal,
  title,
  subtitle,
  description
}: ReportItemDisplayProps) {
  // Function to render the appropriate icon based on insight priority
  const renderPriorityIcon = (priority: InsightPriority) => {
    switch (priority) {
      case InsightPriority.CRITICAL:
        return <IconAlertCircle className="flex-shrink-0 w-5 h-5 text-red-500 mr-2" aria-hidden="true" />;
      case InsightPriority.SERIOUS:
        return <IconAlertTriangle className="flex-shrink-0 w-5 h-5 text-amber-500 mr-2" aria-hidden="true" />;
      case InsightPriority.IMPORTANT:
        return <IconInfoCircle className="flex-shrink-0 w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" aria-hidden="true" />;
      case InsightPriority.ALWAYS_INCLUDE:
        return <IconBulb className="flex-shrink-0 w-5 h-5 text-blue-500 mr-2" aria-hidden="true" />;
      default:
        return <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full mr-3 ml-1.5" aria-hidden="true" />;
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

  // Check if we have valid chart data
  const hasValidChartData = reportItem.data && reportItem.data.length > 0;

  return (
    <div className="mb-8 space-y-4">
      {/* Title section */}
      {title && (
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
      )}
      
      {/* Subtitle */}
      {subtitle && (
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          {subtitle}
        </h3>
      )}
      
      {/* Description */}
      {description && (
        <p className="text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}
      
      {/* Chart */}
      <div className="mt-4">
        {hasValidChartData ? (
          <AgpChart
            data={reportItem.data}
            units={units}
            patientLowGoal={patientLowGoal}
            patientHighGoal={patientHighGoal}
          />
        ) : (
          <div className="flex items-center justify-center h-[200px] w-full border rounded-lg bg-gray-100 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">No chart data available</p>
          </div>
        )}
      </div>
      
      {/* Insights */}
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2 text-gray-800 dark:text-gray-200">
          Insights {reportItem.insights.length > 0 ? `(${reportItem.insights.length})` : ''}
        </h4>
        
        {reportItem.insights.length > 0 ? (
          <ul className="space-y-2" role="list" aria-label="Chart insights">
            {reportItem.insights.map(renderInsight)}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">
            No insights available for this chart
          </p>
        )}
      </div>
    </div>
  );
}
