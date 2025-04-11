'use client';

import * as React from 'react';
import { GlucoseUnits, NightscoutEntry } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { MG_DL_PER_MMOL_L } from '@/utils/utils';
import { TimeCluster } from '@/lib/events/time_clustering/time_clustering';
import { GlycemicEvent, GlycemicEventType } from '@/lib/events/detect_events';

/**
 * Defines the props accepted by the ClusterEventsChart component.
 */
export interface ClusterEventsChartProps {
  /**
   * The cluster of glycemic events to display
   */
  cluster: TimeCluster;
  /**
   * Raw Nightscout entries to use for plotting the glucose data
   */
  entries: NightscoutEntry[];
  /**
   * Specifies the units ('mg/dl' or 'mmol/L') for the glucose values.
   */
  units: GlucoseUnits;
  /**
   * Optional patient-specific low threshold
   */
  patientLowGoal?: number;
  /**
   * Optional patient-specific high threshold
   */
  patientHighGoal?: number;
  /**
   * An optional title to display above the chart.
   */
  title?: string;
}

/**
 * Helper function to filter and transform Nightscout entries
 */
function processEntries(entries: NightscoutEntry[]): { dateString: string; glucose: number }[] {
  // Validate entries
  if (!entries || entries.length === 0) {
    return [];
  }
  
  // Sort entries by date
  const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
  
  // Transform to simplified format
  return sortedEntries.map(entry => ({
    dateString: new Date(entry.date).toISOString(),
    glucose: entry.sgv
  }));
}

/**
 * Helper function to get a color for a specific event
 */
function getEventColor(index: number): string {
  // Array of distinct colors for different events
  const colors = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', 
    '#73c0de', '#3ba272', '#fc8452', '#9a60b4'
  ];
  
  return colors[index % colors.length];
}

/**
 * Helper function to get color based on event type
 */
function getEventTypeColor(eventType: GlycemicEventType): string {
  switch(eventType) {
    case GlycemicEventType.HYPERGLYCEMIA:
      return 'rgba(238, 102, 102, 0.2)'; // Red with transparency
    case GlycemicEventType.HYPOGLYCEMIA:
      return 'rgba(91, 143, 249, 0.2)'; // Blue with transparency
    case GlycemicEventType.SEVERE_HYPOGLYCEMIA:
      return 'rgba(55, 70, 173, 0.2)'; // Darker blue with transparency
    default:
      return 'rgba(150, 150, 150, 0.2)'; // Gray fallback
  }
}

/**
 * Helper function to format time for display
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Helper function to add minutes to a date
 */
function addMinutes(dateString: string, minutes: number): Date {
  const date = new Date(dateString);
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Helper function to subtract minutes from a date
 */
function subtractMinutes(dateString: string, minutes: number): Date {
  const date = new Date(dateString);
  return new Date(date.getTime() - minutes * 60000);
}

/**
 * Renders a chart showing multiple glycemic events from a time cluster.
 * Each event is displayed as a separate line, with appropriate highlighting
 * for the event duration and annotations for event boundaries.
 */
export function ClusterEventsChart({
  cluster,
  entries,
  units,
  patientLowGoal,
  patientHighGoal,
  title = 'Glycemic Event Cluster Analysis',
}: ClusterEventsChartProps) {
  // Process the entries data
  const processedEntries = React.useMemo(() => {
    const processed = processEntries(entries);
    console.log('Processed entries for cluster chart:', {
      totalReadings: processed.length,
      firstReading: processed.length > 0 ? processed[0].dateString : 'none',
      lastReading: processed.length > 0 ? processed[processed.length - 1].dateString : 'none'
    });
    return processed;
  }, [entries]);
  
  // Helper function to format glucose values
  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') {
      return 'N/A';
    }
    const fixedDecimals = units === 'mmol/L' ? 1 : 0;
    return value.toFixed(fixedDecimals);
  };

  // Calculate time window for the chart
  const getTimeWindowData = React.useMemo(() => {
    // Find earliest start time from events
    const earliestStartTime = cluster.events.reduce((earliest, event) => {
      const currentDate = new Date(event.start_timestamp);
      return earliest === null || currentDate < earliest ? currentDate : earliest;
    }, null as Date | null);

    // Find latest end time from events
    const latestEndTime = cluster.events.reduce((latest, event) => {
      const currentDate = new Date(event.end_timestamp);
      return latest === null || currentDate > latest ? currentDate : latest;
    }, null as Date | null);

    if (!earliestStartTime || !latestEndTime || processedEntries.length === 0) {
      return { windowStartTime: new Date(), windowEndTime: new Date(), series: [] };
    }

    // Start time is 60 mins before earliest event
    const windowStartTime = new Date(earliestStartTime.getTime() - 60 * 60 * 1000);
    
    // End time is 30 mins after latest event
    const windowEndTime = new Date(latestEndTime.getTime() + 30 * 60 * 1000);

    // Generate series data for each event
    const series = cluster.events.map((event, index) => {
      // Get all glucose readings in our extended time window
      const eventStartTime = subtractMinutes(event.start_timestamp, 60);
      const eventEndTime = addMinutes(event.end_timestamp, 30);
      
      // Filter glucose readings for this event's time window
      const eventGlucoseData = processedEntries.filter(g => {
        const readingTime = new Date(g.dateString);
        return readingTime >= eventStartTime && readingTime <= eventEndTime;
      });

      // Sort by time
      eventGlucoseData.sort((a, b) => 
        new Date(a.dateString).getTime() - new Date(b.dateString).getTime()
      );

      // Create data points for chart
      const eventData = eventGlucoseData.map(g => ({
        value: [g.dateString, g.glucose],
        // Add custom data for tooltip
        duration: event.duration_minutes,
        extreme: event.extreme_bg_mgdl,
        eventType: event.event_type,
        isInEventRange: new Date(g.dateString) >= new Date(event.start_timestamp) && 
                      new Date(g.dateString) <= new Date(event.end_timestamp)
      }));

      // Create the series config
      return {
        name: `Event ${index + 1} (${formatTime(event.start_timestamp)})`,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: (val: any) => {
          // Make points larger within the actual event time range
          return val[2]?.isInEventRange ? 8 : 4;
        },
        lineStyle: {
          width: 2,
          color: getEventColor(index),
        },
        itemStyle: {
          color: (params: any) => {
            // Color points differently within the event time range
            return params.data.isInEventRange ? 
              getEventColor(index) : 'rgba(128, 128, 128, 0.5)';
          }
        },
        data: eventData,
        markArea: {
          itemStyle: {
            color: getEventTypeColor(event.event_type),
            borderWidth: 1,
            borderType: 'dashed',
            borderColor: getEventColor(index),
          },
          data: [[
            { 
              name: `Event ${index + 1}`,
              xAxis: event.start_timestamp 
            },
            { 
              xAxis: event.end_timestamp 
            }
          ]]
        },
        // Add markers for event start and end
        markPoint: {
          symbol: 'pin',
          symbolSize: 40,
          itemStyle: {
            color: getEventColor(index)
          },
          data: [
            { name: 'Start', value: formatTime(event.start_timestamp), xAxis: event.start_timestamp, yAxis: event.extreme_bg_mgdl },
            { name: 'End', value: formatTime(event.end_timestamp), xAxis: event.end_timestamp, yAxis: event.extreme_bg_mgdl }
          ]
        }
      };
    });

    return { windowStartTime, windowEndTime, series };
  }, [cluster, processedEntries]);

  // Clinical target ranges (always shown)
  const clinicalLow = units === 'mmol/L' ? 3.9 : 70;
  const clinicalHigh = units === 'mmol/L' ? 10 : 180;

  // Convert patient goals if needed
  const adjustedPatientLowGoal = patientLowGoal && units === 'mmol/L' ? 
    patientLowGoal / MG_DL_PER_MMOL_L : patientLowGoal;
    
  const adjustedPatientHighGoal = patientHighGoal && units === 'mmol/L' ? 
    patientHighGoal / MG_DL_PER_MMOL_L : patientHighGoal;

  // Check if we have valid data to display
  if (cluster.events.length === 0 || getTimeWindowData.series.length === 0 || processedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No event data available for this cluster.</p>
      </div>
    );
  }

  // ECharts configuration
  const options = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontWeight: 'normal',
        fontSize: 16,
      },
    },
    tooltip: {
      trigger: 'axis',
      formatter: function (params: any) {
        const firstItem = params[0];
        if (!firstItem) return '';
        
        // Get the time from the first data point
        const time = new Date(firstItem.value[0]);
        const formattedTime = time.toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Build tooltip content
        let content = `<div style="font-weight: bold; margin-bottom: 5px;">${formattedTime}</div>`;
        
        // Add each event's glucose value
        params.forEach((param: any) => {
          if (param.data && param.seriesName) {
            const glucose = param.data.value[1];
            const isInEventRange = param.data.isInEventRange;
            
            // Highlight if this point is within event range
            const style = isInEventRange ? 
              'font-weight: bold; text-decoration: underline;' : '';
            
            content += `<div style="${style}">
              <span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>
              ${param.seriesName}: ${formatValue(glucose)} ${units}
              ${isInEventRange ? ' (event in progress)' : ''}
            </div>`;
          }
        });
        
        return content;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        formatter: function (value: number) {
          const date = new Date(value);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      },
    },
    yAxis: {
      type: 'value',
      name: `Glucose (${units})`,
      nameLocation: 'middle',
      nameGap: 50,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    series: [
      // Add each event series
      ...getTimeWindowData.series,
      
      // Clinical low threshold line
      {
        name: 'Clinical Low',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 1,
          type: 'dashed',
          color: '#ff4d4f',
        },
        markLine: {
          silent: true,
          lineStyle: {
            color: '#ff4d4f',
            type: 'dashed',
            width: 1,
          },
          label: {
            show: true,
            position: 'end',
            formatter: 'Low',
          },
          data: [{ yAxis: clinicalLow }]
        },
        data: [],
        tooltip: {
          show: false,
        }
      },
      
      // Clinical high threshold line
      {
        name: 'Clinical High',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 1,
          type: 'dashed',
          color: '#ff4d4f',
        },
        markLine: {
          silent: true,
          lineStyle: {
            color: '#ff4d4f',
            type: 'dashed',
            width: 1,
          },
          label: {
            show: true,
            position: 'end',
            formatter: 'High',
          },
          data: [{ yAxis: clinicalHigh }]
        },
        data: [],
        tooltip: {
          show: false,
        }
      },
      
      // Patient low goal line (if provided)
      ...(adjustedPatientLowGoal ? [
        {
          name: 'Patient Low Goal',
          type: 'line',
          symbol: 'none',
          lineStyle: {
            width: 1,
            color: '#52c41a',
          },
          markLine: {
            silent: true,
            lineStyle: {
              color: '#52c41a',
              type: 'dashed',
              width: 1,
            },
            label: {
              show: true,
              position: 'end',
              formatter: 'Target Low',
            },
            data: [{ yAxis: adjustedPatientLowGoal }]
          },
          data: [],
          tooltip: {
            show: false,
          }
        }
      ] : []),
      
      // Patient high goal line (if provided)
      ...(adjustedPatientHighGoal ? [
        {
          name: 'Patient High Goal',
          type: 'line',
          symbol: 'none',
          lineStyle: {
            width: 1,
            color: '#52c41a',
          },
          markLine: {
            silent: true,
            lineStyle: {
              color: '#52c41a',
              type: 'dashed',
              width: 1,
            },
            label: {
              show: true,
              position: 'end',
              formatter: 'Target High',
            },
            data: [{ yAxis: adjustedPatientHighGoal }]
          },
          data: [],
          tooltip: {
            show: false,
          }
        }
      ] : []),
    ],
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 10,
      data: getTimeWindowData.series.map(s => s.name)
    },
  };

  return (
    <div className="w-full h-[400px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <ReactECharts
        option={options}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // Using SVG renderer for better quality
      />
    </div>
  );
}