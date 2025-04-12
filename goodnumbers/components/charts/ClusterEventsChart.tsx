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
 * All events are normalized to show on the same time axis regardless of date.
 * This makes it easier to identify patterns that occur at similar times across different days.
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
    // Use a common reference date (today) to normalize all events
    const referenceDate = new Date();
    referenceDate.setHours(0, 0, 0, 0); // Set to midnight

    // Function to normalize a timestamp to reference date while preserving time
    const normalizeToReferenceDate = (timestamp: string): Date => {
      const originalDate = new Date(timestamp);
      const normalizedDate = new Date(referenceDate);
      normalizedDate.setHours(
        originalDate.getHours(),
        originalDate.getMinutes(),
        originalDate.getSeconds(),
        originalDate.getMilliseconds()
      );
      return normalizedDate;
    };

    // Find earliest and latest time (by time of day, not actual date)
    let earliestTimeOfDay = 24 * 60; // Minutes from midnight (max possible)
    let latestTimeOfDay = 0; // Minutes from midnight (min possible)

    cluster.events.forEach(event => {
      const startDate = new Date(event.start_timestamp);
      const endDate = new Date(event.end_timestamp);
      
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      
      earliestTimeOfDay = Math.min(earliestTimeOfDay, startMinutes);
      latestTimeOfDay = Math.max(latestTimeOfDay, endMinutes);
    });

    // Add buffer on both sides (60 minutes before, 30 minutes after)
    const bufferBeforeMinutes = 60;
    const bufferAfterMinutes = 30;
    
    // Convert to Date objects
    const windowStartTime = new Date(referenceDate);
    windowStartTime.setMinutes(Math.max(0, earliestTimeOfDay - bufferBeforeMinutes));
    
    const windowEndTime = new Date(referenceDate);
    // Handle case where end time might go into next day
    if (latestTimeOfDay + bufferAfterMinutes >= 24 * 60) {
      windowEndTime.setDate(windowEndTime.getDate() + 1);
      windowEndTime.setMinutes((latestTimeOfDay + bufferAfterMinutes) % (24 * 60));
    } else {
      windowEndTime.setMinutes(latestTimeOfDay + bufferAfterMinutes);
    }

    if (processedEntries.length === 0) {
      return { windowStartTime, windowEndTime, series: [], referenceDate };
    }

    // Generate both line series and background series
    const lineSeries = cluster.events.map((event, index) => {
      // Normalize event timestamps to reference date
      const normalizedStartTime = normalizeToReferenceDate(event.start_timestamp);
      const normalizedEndTime = normalizeToReferenceDate(event.end_timestamp);
      
      // Convert extreme glucose value to correct units if needed
      const extremeGlucoseValue = units === 'mmol/L' ? 
        event.extreme_bg_mgdl / MG_DL_PER_MMOL_L : event.extreme_bg_mgdl;
      
      // Original dates for display in tooltips
      const originalStartDate = new Date(event.start_timestamp);
      const dateStr = originalStartDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      // Get all glucose readings in the relevant time window for this event
      const eventStartTime = new Date(event.start_timestamp);
      const eventEndTime = new Date(event.end_timestamp);
      
      // Buffer times for data before and after event
      const bufferStartTime = new Date(eventStartTime);
      bufferStartTime.setMinutes(eventStartTime.getMinutes() - bufferBeforeMinutes);
      
      const bufferEndTime = new Date(eventEndTime);
      bufferEndTime.setMinutes(eventEndTime.getMinutes() + bufferAfterMinutes);

      // Filter glucose readings for this event's time window
      const eventGlucoseData = processedEntries.filter(g => {
        const readingTime = new Date(g.dateString);
        return readingTime >= bufferStartTime && readingTime <= bufferEndTime;
      });

      // Sort by time
      eventGlucoseData.sort((a, b) =>
        new Date(a.dateString).getTime() - new Date(b.dateString).getTime()
      );

      // Create normalized data points for chart
      const eventData = eventGlucoseData.map(g => {
        const originalTime = new Date(g.dateString);
        // Create normalized time (same reference date but keep original time)
        const normalizedTime = normalizeToReferenceDate(g.dateString);
        
        // Convert glucose values to the correct units if needed
        const glucoseValue = units === 'mmol/L' ? 
          g.glucose / MG_DL_PER_MMOL_L : g.glucose;
        
        return {
          // Use normalized time for X-axis and correctly converted glucose value
          value: [normalizedTime.toISOString(), glucoseValue],
          // Original data for tooltip and other references
          originalTime: originalTime,
          originalDateString: g.dateString,
          originalGlucose: g.glucose, // Original value in mg/dL
          glucoseInUserUnits: glucoseValue, // Converted to user's preferred units
          originalDateStr: originalTime.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          duration: event.duration_minutes,
          extreme: extremeGlucoseValue,  // Use converted value
          extremeOriginal: event.extreme_bg_mgdl,  // Store original for reference
          eventType: event.event_type,
          // Check if point is within event time range (using original times)
          isInEventRange: originalTime >= eventStartTime && originalTime <= eventEndTime
        };
      });

      // Create the series config
      return {
        name: `Event ${index + 1} (${formatTime(event.start_timestamp)}, ${dateStr})`,
        type: 'line',
        smooth: false, // Disable smoothing for crisper lines
        symbol: 'circle',
        symbolSize: (val: any) => {
          // Make points larger within the actual event time range, and larger overall
          return val[2]?.isInEventRange ? 10 : 6;
        },
        lineStyle: {
          width: 3, // Thicker lines for better visibility
          color: getEventColor(index),
        },
        emphasis: {
          // Highlight effect when hovering
          focus: 'self', // Only focus this series (to keep others visible)
          lineStyle: {
            width: 6, // Even thicker on hover
            color: getEventColor(index)
          },
          itemStyle: {
            borderWidth: 3,
            borderColor: getEventColor(index)
          },
          // Apply stronger effect with z-index change to bring the series to front
          z: 100
        },
        itemStyle: {
          color: (params: any) => {
            // Color points differently within the event time range
            return params.data.isInEventRange ?
              getEventColor(index) : 'rgba(128, 128, 128, 0.5)';
          }
        },
        data: eventData,
      };
    });

    // Create background series for each event
    const backgroundSeries = cluster.events.map((event, index) => {
      // Normalize event timestamps to reference date
      const normalizedStartTime = normalizeToReferenceDate(event.start_timestamp);
      const normalizedEndTime = normalizeToReferenceDate(event.end_timestamp);

      // Create a background area that will only show when highlighted by the event handler
      return {
        name: `Event ${index + 1} Background`,
        type: 'line', // Simple line series
        showSymbol: false, // No symbols
        silent: true, // Don't capture mouse events
        zlevel: -1, // Behind all other elements
        lineStyle: {
          opacity: 0, // Invisible line
          width: 0,
        },
        data: [[normalizedStartTime.toISOString(), 0], [normalizedEndTime.toISOString(), 0]], // Just for the x-axis range
        markArea: {
          silent: true,
          itemStyle: {
            color: getEventTypeColor(event.event_type),
            opacity: 0, // Start invisible
          },
          // When highlighted via event handler
          emphasis: {
            itemStyle: {
              color: getEventTypeColor(event.event_type),
              opacity: 0.35, // Only visible when highlighted
            }
          },
          data: [[
            { xAxis: normalizedStartTime.toISOString() },
            { xAxis: normalizedEndTime.toISOString() }
          ]]
        },
        tooltip: {
          show: false, // No tooltip
        }
      };
    });

    // Modify the line series to include IDs for linking
    const updatedLineSeries = lineSeries.map((series, index) => ({
      ...series,
      id: `event-${index}`, // Add ID for linking with background
    }));

    return { 
      windowStartTime, 
      windowEndTime, 
      series: [...updatedLineSeries, ...backgroundSeries],
      referenceDate 
    };
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

  // Add a subtitle explaining the time alignment
  const subtitle = 'Events from different days aligned by time of day';

  // ECharts configuration
  const options = {
    title: {
      text: title,
      subtext: subtitle,
      left: 'center',
      textStyle: {
        fontWeight: 'normal',
        fontSize: 16,
      },
      subtextStyle: {
        fontSize: 12,
        color: '#888',
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function (params: any) {
        const firstItem = params[0];
        if (!firstItem) return '';

        // Get the time from the normalized data point
        const normalizedTime = new Date(firstItem.value[0]);
        const formattedTime = normalizedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        // Build tooltip content - simplified version
        let content = `<div style="font-weight: bold; margin-bottom: 8px;">Time: ${formattedTime}</div>`;

        // Add each event's glucose value - simplified format
        params.forEach((param: any) => {
          if (param.data && param.seriesName && !param.seriesName.includes('Background')) {
            // Skip background series
            const glucose = param.data.glucoseInUserUnits || 
              (param.data.value && Array.isArray(param.data.value) ? param.data.value[1] : null);
            
            if (glucose === null) return; // Skip if no glucose value
            
            // Extract just the event number from the full series name
            const match = param.seriesName.match(/Event (\d+)/);
            if (!match) return; // Skip if no match
            
            const eventNumber = match[1];
            
            content += `<div style="margin-bottom: 4px;">
              <span style="display:inline-block;margin-right:6px;border-radius:10px;width:8px;height:8px;background-color:${param.color};"></span>
              Event ${eventNumber}, ${formatValue(glucose)} ${units}
            </div>`;
          }
        });

        return content;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '20%',  // Increase bottom margin to make room for both axis labels and legend
      containLabel: true,
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      min: getTimeWindowData.windowStartTime.toISOString(),
      max: getTimeWindowData.windowEndTime.toISOString(),
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
      axisPointer: {
        label: {
          formatter: function (params: any) {
            const date = new Date(params.value);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }
      }
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
    // Add special chart configuration for highlighting the hovered series
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 35,  // Move the legend further down to avoid overlapping with x-axis labels
      data: getTimeWindowData.series
        .filter(s => !s.name.includes('Background')) // Only show line series in legend
        .map(s => s.name),
      selected: getTimeWindowData.series
        .filter(s => !s.name.includes('Background'))
        .reduce((acc, series) => {
          // Set all events to be selected by default
          acc[series.name] = true;
          return acc;
        }, {} as Record<string, boolean>),
      selectedMode: 'multiple', // Allow multiple or single selection
    },
    // When user hovers over a series, highlight it and dim others
    // This uses the native echarts behavior for this effect
    highlightPolicy: 'visual',
    emphasis: {
      focus: 'self', // Only focus the hovered element, don't blur others
      scale: false, // No scaling effect
    },
    // Remove animation and transitions
    animation: false,
    blur: {
      // Style for non-highlighted series - make them visible
      lineStyle: {
        color: '#DDDDDD', // Light gray with no transparency
        width: 1,
        opacity: 0.7, // Higher opacity for better visibility
      },
      itemStyle: {
        color: '#DDDDDD', // Light gray with no transparency 
        opacity: 0.7, // Higher opacity for better visibility
      },
      // Don't affect the markArea opacity with blur
      areaStyle: {
        opacity: 1 // Keep the original opacity for markArea
      }
    },
  };

  return (
    <div className="w-full h-[450px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <ReactECharts
        option={options}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // Using SVG renderer for crisp lines
        onEvents={{
          // Listen for mouseover events on series
          'mouseover': (params: any) => {
            // Update the chart when hovering over a line series (not background)
            if (params.seriesName && !params.seriesName.includes('Background')) {
              // Extract the event index
              const match = params.seriesName.match(/Event (\d+)/);
              if (match) {
                const eventIndex = parseInt(match[1]) - 1;
                // Create background for just this event
                const echartsInstance = (params.event as any).target;
                
                // First downplay all background series
                for (let i = 0; i < cluster.events.length; i++) {
                  echartsInstance.dispatchAction({
                    type: 'downplay',
                    seriesIndex: getTimeWindowData.series.findIndex(
                      s => s.name === `Event ${i+1} Background`
                    )
                  });
                }
                
                // Then highlight only the one we want
                echartsInstance.dispatchAction({
                  type: 'highlight',
                  seriesIndex: getTimeWindowData.series.findIndex(
                    s => s.name === `Event ${eventIndex+1} Background`
                  )
                });
              }
            }
          },
          // Handle mouseout to reset
          'mouseout': (params: any) => {
            const echartsInstance = (params.event as any).target;
            // Hide all backgrounds when not hovering
            for (let i = 0; i < cluster.events.length; i++) {
              echartsInstance.dispatchAction({
                type: 'downplay',
                seriesIndex: getTimeWindowData.series.findIndex(
                  s => s.name === `Event ${i+1} Background`
                )
              });
            }
          }
        }}
      />
    </div>
  );
}