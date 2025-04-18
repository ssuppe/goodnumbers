'use client';

// --- Imports ---
import * as React from 'react';
import { useRef, useMemo } from 'react';
import { GlucoseUnits, NightscoutEntry } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
// No need to import 'echarts/core' explicitly when using ReactECharts unless using specific extensions
import { MG_DL_PER_MMOL_L } from '@/utils/utils';
import { TimeCluster } from '@/lib/events/time_clustering/time_clustering';
import { GlycemicEvent, GlycemicEventType } from '@/lib/events/detect_events';

// --- Interfaces ---
export interface ClusterEventsChartProps {
  cluster: TimeCluster;
  entries: NightscoutEntry[];
  units: GlucoseUnits;
  patientLowGoal?: number;
  patientHighGoal?: number;
  title?: string;
}

// --- Helper Functions ---

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

function processEntries(entries: NightscoutEntry[]): { dateString: string; glucose: number }[] {
  if (!entries || entries.length === 0) return [];
  const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
  return sortedEntries.map((entry) => ({
    dateString: new Date(entry.date).toISOString(),
    glucose: entry.sgv,
  }));
}

// Palette designed for better accessibility and contrast (e.g., Tablueau 10)
const eventColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
// Line styles for additional visual distinction when many lines are present
const lineStyleTypes = ['solid', 'dashed', 'dotted'];

function getEventVisuals(index: number): { color: string; lineType: string } {
  return {
    color: eventColors[index % eventColors.length],
    lineType: lineStyleTypes[index % lineStyleTypes.length],
  };
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Main Component ---

export function ClusterEventsChart({
  cluster,
  entries,
  units,
  patientLowGoal,
  patientHighGoal,
  title = 'Glycemic Event Cluster Analysis',
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Effect to refresh chart when needed
  React.useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart) {
      chart.resize();
    }
    // Dependency array includes props that might change chart dimensions or content
  }, [cluster, entries, units, patientLowGoal, patientHighGoal, title]);

  const processedEntries = useMemo(() => processEntries(entries), [entries]);

  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    // Use browser's toLocaleString for potentially better locale-specific formatting
    // Adjust minimumFractionDigits based on units
    return value.toLocaleString(undefined, {
      minimumFractionDigits: units === 'mmol/L' ? 1 : 0,
      maximumFractionDigits: units === 'mmol/L' ? 1 : 0,
    });
  };

  const getTimeWindowData = useMemo(() => {
    const referenceDate = new Date();
    // Normalize reference date to start of day to align times correctly
    referenceDate.setHours(0, 0, 0, 0);

    const normalizeToReferenceDate = (timestamp: string | number): Date => {
      const originalDate = new Date(timestamp);
      const normalizedDate = new Date(referenceDate);
      normalizedDate.setHours(
        originalDate.getHours(),
        originalDate.getMinutes(),
        originalDate.getSeconds(),
        originalDate.getMilliseconds(),
      );
      return normalizedDate;
    };

    let earliestTimeOfDay = 24 * 60;
    let latestTimeOfDay = 0;
    cluster.events.forEach((event) => {
      const startDate = new Date(event.start_timestamp);
      const endDate = new Date(event.end_timestamp);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      earliestTimeOfDay = Math.min(earliestTimeOfDay, startMinutes);
      latestTimeOfDay = Math.max(latestTimeOfDay, endMinutes);
    });

    const bufferBeforeMinutes = 60; // Show 60 minutes before the earliest event start
    const bufferAfterMinutes = 30; // Show 30 minutes after the latest event end

    const windowStartTime = new Date(referenceDate);
    windowStartTime.setMinutes(Math.max(0, earliestTimeOfDay - bufferBeforeMinutes));

    const windowEndTime = new Date(referenceDate);
    const proposedEndMinutes = latestTimeOfDay + bufferAfterMinutes;

    // Handle cases where the window crosses midnight
    if (proposedEndMinutes >= 24 * 60) {
      // If the proposed end is past midnight, set the date to the next day
      windowEndTime.setDate(windowEndTime.getDate() + 1);
      windowEndTime.setHours(0, 0, 0, 0); // Reset to start of next day
      windowEndTime.setMinutes(proposedEndMinutes % (24 * 60));
    } else {
      // Otherwise, stay on the same reference date and set the minutes
      windowEndTime.setMinutes(proposedEndMinutes);
    }

    if (processedEntries.length === 0) {
      // Return a default range if no entries to avoid chart errors
      const defaultStart = new Date(referenceDate);
      defaultStart.setHours(0);
      const defaultEnd = new Date(referenceDate);
      defaultEnd.setHours(23, 59);
      return { windowStartTime: defaultStart, windowEndTime: defaultEnd, series: [], referenceDate };
    }

    const lineSeries = cluster.events.map((event, index) => {
      const eventVisuals = getEventVisuals(index); // Get color and line style

      const originalStartDate = new Date(event.start_timestamp);
      const dateStr = originalStartDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      // Determine the actual time window for *this specific event's data*
      const eventStartTimeOriginal = new Date(event.start_timestamp);
      const eventEndTimeOriginal = new Date(event.end_timestamp);
      const bufferStartTimeOriginal = new Date(eventStartTimeOriginal);
      bufferStartTimeOriginal.setMinutes(eventStartTimeOriginal.getMinutes() - bufferBeforeMinutes);
      const bufferEndTimeOriginal = new Date(eventEndTimeOriginal);
      bufferEndTimeOriginal.setMinutes(eventEndTimeOriginal.getMinutes() + bufferAfterMinutes);

      const eventGlucoseData = processedEntries
        .filter((g) => {
          const readingTime = new Date(g.dateString);
          return readingTime >= bufferStartTimeOriginal && readingTime <= bufferEndTimeOriginal;
        })
        .sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());

      const eventData = eventGlucoseData.map((g) => {
        const originalTime = new Date(g.dateString);
        const normalizedTime = normalizeToReferenceDate(g.dateString); // Normalize time to reference date
        const glucoseValue = units === 'mmol/L' ? g.glucose / MG_DL_PER_MMOL_L : g.glucose;
        const isInEventRange = originalTime >= eventStartTimeOriginal && originalTime <= eventEndTimeOriginal;

        return {
          // ECharts requires the time value as a string or number (timestamp)
          value: [normalizedTime.toISOString(), glucoseValue],
          // Store original data for tooltip or other uses
          originalTime,
          originalDateString: g.dateString,
          originalGlucose: g.glucose,
          glucoseInUserUnits: glucoseValue,
          originalDateStr: originalTime.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          duration: event.duration_minutes,
          extreme: units === 'mmol/L' ? event.extreme_bg_mgdl / MG_DL_PER_MMOL_L : event.extreme_bg_mgdl,
          extremeOriginal: event.extreme_bg_mgdl,
          eventType: event.event_type,
          isInEventRange, // Custom property to mark points within the event range
        };
      });

      return {
        name: `Event ${index + 1} (${formatTime(event.start_timestamp)}, ${dateStr})`,
        type: 'line',
        smooth: false, // Keep non-smooth for medical data
        symbol: 'circle',
        // Adjust symbol size based on whether it's within the event range
        symbolSize: (val: any, params: any) => (params.data.isInEventRange ? 8 : 4), // Reduced symbol size slightly
        showSymbol: true, // Ensure symbols are shown for data points
        lineStyle: {
          width: 2, // Slightly thinner line for potentially more lines
          color: eventVisuals.color,
          type: eventVisuals.lineType, // Apply different line styles
        },
        emphasis: {
          focus: 'series',
          lineStyle: { width: 4 }, // Thicker line on hover
          itemStyle: {
            borderWidth: 2, // Thicker border on hover
            borderColor: '#FFFFFF', // White border for contrast
          },
          z: 20, // Bring emphasized series to front
        },
        itemStyle: {
          // Apply color and opacity based on whether it's within the event range
          color: (params: any) => (params.data.isInEventRange ? eventVisuals.color : 'rgba(170, 170, 170, 0.6)'), // Use event color or gray
          opacity: (params: any) => (params.data.isInEventRange ? 1 : 0.7), // Full opacity in range, slightly transparent out of range
        },
        data: eventData,
        id: `event-line-${index}`,
        // Add tooltip configuration directly to the series if needed,
        // but the global tooltip formatter is often sufficient.
      };
    });

    const allSeries = [...lineSeries];

    return {
      windowStartTime,
      windowEndTime,
      series: allSeries,
      referenceDate,
    };
  }, [cluster, processedEntries, units]); // Re-calculate if cluster, entries, or units change

  // Adjust clinical and patient goals based on selected units
  const clinicalLow = units === 'mmol/L' ? 3.9 : 70;
  const clinicalHigh = units === 'mmol/L' ? 10 : 180;
  const adjustedPatientLowGoal =
    patientLowGoal && units === 'mmol/L' ? patientLowGoal / MG_DL_PER_MMOL_L : patientLowGoal;
  const adjustedPatientHighGoal =
    patientHighGoal && units === 'mmol/L' ? patientHighGoal / MG_DL_PER_MMOL_L : patientHighGoal;

  // Handle empty data case
  if (cluster.events.length === 0 || getTimeWindowData.series.length === 0 || processedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No event data available for this cluster.</p>
      </div>
    );
  }

  // Calculate min/max values for Y-axis domain to potentially improve scaling
  const allGlucoseValues = getTimeWindowData.series.flatMap((s) => s.data.map((d: any) => d.value[1]));
  // Include goal lines in min/max calculation to ensure they are visible
  const minDataValue = Math.min(...allGlucoseValues, adjustedPatientLowGoal ?? Infinity, clinicalLow);
  const maxDataValue = Math.max(...allGlucoseValues, adjustedPatientHighGoal ?? -Infinity, clinicalHigh);

  // Determine Y-axis min/max - add padding for readability
  // Ensure min is not too low (e.g., below 0 or a sensible physical minimum)
  const yAxisMin = Math.max(0, Math.floor(minDataValue * 0.9)); // 10% buffer below min data, min 0
  const yAxisMax = Math.ceil(maxDataValue * 1.1); // 10% buffer above max data

  const options = {
    // --- Chart options ---
    // Title is often managed by the parent component's structure, set to null here
    title: {
      text: null,
      subtext: null,
    },
    // Tooltip configuration
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderWidth: 1,
      padding: 12,
      textStyle: {
        fontSize: 13,
        lineHeight: 20,
        color: '#333', // Ensure text color is readable
      },
      formatter: (params: any) => {
        // Check if this is a data point from one of the series
        if (!params || !params.data || !params.data.value) {
          // Hide tooltip for markLines or other non-data series if triggered
          return null;
        }

        const normalizedTime = new Date(params.data.value[0]);
        const formattedTime = normalizedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        // Get the original date if available
        const dateInfo = params.data.originalDateStr
          ? `<div style="margin-bottom: 4px;">Date: ${params.data.originalDateStr}</div>`
          : '';

        // Include event type and duration if available
        const eventTypeInfo = params.data.eventType
          ? `<div style="margin-bottom: 4px;">Type: ${getEventTypeName(params.data.eventType)}</div>`
          : ''; // Use the helper function for event type name
        const durationInfo = params.data.duration
          ? `<div style="margin-bottom: 4px;">Duration: ${params.data.duration} min</div>`
          : '';

        // Get glucose value formatted with units
        const glucoseValueFormatted = `${formatValue(params.data.glucoseInUserUnits)} ${units}`;

        // Extract event label from series name
        const match = params.seriesName.match(/Event (\d+)/);
        const eventLabel = match ? `Event ${match[1]}` : params.seriesName;

        // Construct tooltip content
        let content = `<div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 6px;">Time: ${formattedTime}</div>`;
        content += `${dateInfo}`; // Add date info immediately after time
        content += `<div style="margin-bottom: 6px;"><span style="display:inline-block;margin-right:8px;border-radius:10px;width:10px;height:10px;background-color:${params.color};"></span><span style="font-weight: 500;">${eventLabel}:</span> <span style="margin-left: 5px; font-weight: bold;">${glucoseValueFormatted}</span></div>`;
        content += `${eventTypeInfo}${durationInfo}`;

        return content;
      },
      extraCssText: 'box-shadow: 0 3px 14px rgba(0,0,0,0.15); border-radius: 6px;',
    },
    // *** IMPROVEMENT 1: Adjusted grid padding for better density ***
    grid: {
      // Use pixel values for more precise control
      left: 70, // Space for Y-axis name and labels
      right: 30, // Space for markLine labels (High/Low etc.)
      top: 20, // Space above X-axis labels
      bottom: 100, // Space for X-axis labels and legend
      containLabel: true, // Ensure labels are not cut off
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      min: getTimeWindowData.windowStartTime.toISOString(),
      max: getTimeWindowData.windowEndTime.toISOString(),
      axisLine: { show: true, lineStyle: { color: '#ccc' } }, // Added axis line color for clarity
      axisTick: { show: true, lineStyle: { color: '#ccc' } }, // Added axis tick color
      axisLabel: {
        formatter: (value: number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        color: '#333', // Ensure label color is readable
        textStyle: {
          fontSize: 12, // Slightly smaller font size for labels
        },
      },
      axisPointer: {
        label: {
          formatter: (params: any) =>
            new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      },
    },
    yAxis: {
      type: 'value',
      // *** IMPROVEMENT 4: Y-axis Units Label ***
      name: `Glucose (${units})`, // Name includes the unit
      nameLocation: 'middle', // Position the name in the middle
      nameGap: 50, // Space between the name and the axis line/labels
      nameTextStyle: {
        fontSize: 14, // Font size for the name
        fontWeight: 'bold',
        color: '#333', // Color for the name
        padding: [0, 0, 0, 0], // Adjust padding if needed
      },
      // *** Added min/max based on data range for better scaling ***
      min: yAxisMin,
      max: yAxisMax,
      // Force integer axis labels if units are mg/dL, allow decimals for mmol/L
      axisLabel: {
        formatter: (value: number) => formatValue(value), // Use consistent formatter
        color: '#333', // Ensure label color is readable
        textStyle: {
          fontSize: 12, // Slightly smaller font size for labels
        },
      },
      axisLine: { show: false }, // Keep axis line hidden on Y-axis
      axisTick: { show: false }, // Keep ticks hidden on Y-axis
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          opacity: 0.4, // Slightly less prominent dashed lines
        },
      },
    },
    series: [
      /* Data series generated in getTimeWindowData */
      ...getTimeWindowData.series,
      /* Mark lines for clinical ranges */
      {
        name: 'Clinical Low',
        type: 'line', // Needs to be a line type for markLine to work
        data: [], // No data points for this series, just the markLine
        silent: true, // Make it not interactive
        tooltip: { show: false }, // Hide tooltip for this series
        markLine: {
          silent: true, // Make markLine itself not interactive
          lineStyle: { color: '#f5222d', type: 'dashed', width: 2 }, // More standard error/danger red
          label: {
            show: true,
            position: 'end',
            formatter: 'Low',
            fontSize: 11, // Slightly smaller label
            fontWeight: 'bold',
            color: '#333', // Label color
            backgroundColor: '#fff', // Background for readability over lines
            padding: [2, 5], // Padding around label
            borderRadius: 3,
          },
          data: [{ yAxis: clinicalLow }],
        },
        z: 10, // Ensure markLines are above grid lines but below data lines (data z is default 2)
      },
      {
        name: 'Clinical High',
        type: 'line',
        data: [],
        silent: true,
        tooltip: { show: false },
        markLine: {
          silent: true,
          lineStyle: { color: '#f5222d', type: 'dashed', width: 2 }, // More standard error/danger red
          label: {
            show: true,
            position: 'end',
            formatter: 'High',
            fontSize: 11,
            fontWeight: 'bold',
            color: '#333',
            backgroundColor: '#fff',
            padding: [2, 5],
            borderRadius: 3,
          },
          data: [{ yAxis: clinicalHigh }],
        },
        z: 10,
      },
      /* Mark lines for patient goals (conditional rendering) */
      ...(adjustedPatientLowGoal !== undefined && adjustedPatientLowGoal !== null
        ? [
            {
              name: 'Patient Low Goal',
              type: 'line',
              data: [],
              silent: true,
              tooltip: { show: false },
              markLine: {
                silent: true,
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 }, // Standard success/target green, slightly thinner
                label: {
                  show: true,
                  position: 'end',
                  formatter: 'Target Low',
                  fontSize: 11,
                  color: '#333',
                  backgroundColor: '#fff',
                  padding: [2, 5],
                  borderRadius: 3,
                },
                data: [{ yAxis: adjustedPatientLowGoal }],
              },
              z: 10,
            },
          ]
        : []),
      ...(adjustedPatientHighGoal !== undefined && adjustedPatientHighGoal !== null
        ? [
            {
              name: 'Patient High Goal',
              type: 'line',
              data: [],
              silent: true,
              tooltip: { show: false },
              markLine: {
                silent: true,
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 }, // Standard success/target green, slightly thinner
                label: {
                  show: true,
                  position: 'end',
                  formatter: 'Target High',
                  fontSize: 11,
                  color: '#333',
                  backgroundColor: '#fff',
                  padding: [2, 5],
                  borderRadius: 3,
                },
                data: [{ yAxis: adjustedPatientHighGoal }],
              },
              z: 10,
            },
          ]
        : []),
    ],
    legend: {
      type: 'scroll', // Use scrollable legend if many items
      orient: 'horizontal',
      bottom: 10, // Position relative to the chart container bottom
      padding: [10, 20], // Padding around the legend content
      itemGap: 15, // Space between legend items
      textStyle: {
        fontSize: 12,
        color: '#333', // Ensure text color is readable
      },
      // Filter legend data to only include the event series lines
      data: getTimeWindowData.series.map((s) => s.name!),
      selected: getTimeWindowData.series.reduce(
        (acc, series) => {
          // Set all event series to be initially selected/visible
          acc[series.name!] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
      selectedMode: 'multiple', // Allow selecting/deselecting multiple series
      // Position legend relative to container, the grid.bottom ensures space above it
    },
    // Highlight configuration
    highlightPolicy: 'series', // Highlight the whole series on hover
    emphasis: {
      focus: 'series',
      scale: false, // Don't scale the series on hover, just change style
    },
    // Turn off animations for static display
    animation: false,
    animationDuration: 0,
    animationEasing: 'linear',
    // Define how non-emphasized series appear (blur them slightly)
    blur: {
      lineStyle: { color: '#BBBBBB', width: 1.5, opacity: 0.7 }, // Slightly dimmed and thinner
      itemStyle: { color: '#BBBBBB', opacity: 0.7 },
      z: 1, // Keep blurred items below emphasized ones (z: 20)
    },
    // Adjust overall chart background/border if needed, but parent div handles this via Tailwind
  };

  return (
    // Parent div provides dimensions and basic styling
    <div className="w-full h-[450px] p-1 border rounded-lg shadow-sm bg-card text-card-foreground relative">
      {' '}
      {/* Reduced padding here as grid handles internal spacing */}
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: '100%', width: '100%' }} // ECharts takes up full size of parent div
        opts={{ renderer: 'svg' }} // SVG renderer generally preferred for web apps
      />
    </div>
  );
}
