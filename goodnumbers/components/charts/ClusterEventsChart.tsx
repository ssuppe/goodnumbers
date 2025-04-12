'use client';

// --- Imports ---
import * as React from 'react';
import { useRef, useMemo } from 'react'; // Import necessary React hooks
import { GlucoseUnits, NightscoutEntry } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core'; // Import echarts core if needed, though ReactECharts handles it
import { MG_DL_PER_MMOL_L } from '@/utils/utils';
import { TimeCluster } from '@/lib/events/time_clustering/time_clustering';
import { GlycemicEvent, GlycemicEventType } from '@/lib/events/detect_events';

// --- Interfaces ---

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

// --- Helper Functions ---

/**
 * Helper function to filter and transform Nightscout entries
 */
function processEntries(entries: NightscoutEntry[]): { dateString: string; glucose: number }[] {
  if (!entries || entries.length === 0) {
    return [];
  }
  const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
  return sortedEntries.map((entry) => ({
    dateString: new Date(entry.date).toISOString(),
    glucose: entry.sgv, // Assuming sgv is always in mg/dL from Nightscout
  }));
}

/**
 * Helper function to get a distinct color for a specific event index.
 */
function getEventColor(index: number): string {
  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];
  return colors[index % colors.length];
}

/**
 * Helper function to get a background color based on event type.
 */
function getEventTypeColor(eventType: GlycemicEventType): string {
  switch (eventType) {
    case GlycemicEventType.HYPERGLYCEMIA:
      // return 'rgba(238, 102, 102, 0.2)'; // Reddish background base
      return 'rgba(255, 0, 0, 0.2)'; // Reddish background base color

    case GlycemicEventType.HYPOGLYCEMIA:
      // return 'rgba(91, 143, 249, 0.2)'; // Bluish background base color
      return 'rgba(0, 255, 0, 0.2)'; // Bluish background base color

    case GlycemicEventType.SEVERE_HYPOGLYCEMIA:
      // return 'rgba(55, 70, 173, 0.2)'; // Darker blue background base color
      return 'rgba(0, 0, 255, 0.2)'; // Darker blue background base color

    default:
      return 'rgba(150, 150, 150, 1)'; // Gray fallback
  }
}

/**
 * Helper function to format time for display (e.g., in series name).
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Helper function to hide all background areas in the chart
 */
function hideAllBackgrounds(echartsInstance: any): void {
  const currentOptions = echartsInstance.getOption();
  const currentSeries = currentOptions.series || [];

  // Find all background series
  const backgroundSeries = currentSeries.filter((s: any) => s.name && s.name.includes('Background'));

  // Prepare a list of updates to disable all background series at once
  const updates = backgroundSeries.map(series => {
    if (series.id) {
      return { id: series.id, show: false }; // Hide by ID
    } else {
      const seriesIndex = currentSeries.findIndex((s: any) => s === series);
      if (seriesIndex !== -1) {
        return { seriesIndex: seriesIndex, show: false }; // Hide by index
      }
    }
    return null;
  }).filter(Boolean);
  
  // Apply all updates at once
  if (updates.length > 0) {
    echartsInstance.setOption({
      series: updates
    });
  }
}

/**
 * Helper function to show background for a specific event number
 */
function showBackgroundForEvent(echartsInstance: any, eventNumber: number): void {
  const currentOptions = echartsInstance.getOption();
  const currentSeries = currentOptions.series || [];

  // Find the specific background series by name
  const targetBackgroundName = `Event ${eventNumber} Background`;
  const targetSeries = currentSeries.find((s: any) => s.name === targetBackgroundName);

  // If found, show only this background
  if (targetSeries) {
    const update = targetSeries.id 
      ? { id: targetSeries.id, show: true } // Show by ID
      : { seriesIndex: currentSeries.indexOf(targetSeries), show: true }; // Show by index
      
    echartsInstance.setOption({
      series: [update]
    });
  }
}

// --- Main Component ---

/**
 * Renders a chart showing multiple glycemic events from a time cluster.
 * Events are aligned by time of day to facilitate pattern recognition.
 * Includes hover effects: highlights the hovered line and shows ONLY its background area.
 */
export function ClusterEventsChart({
  cluster,
  entries,
  units,
  patientLowGoal,
  patientHighGoal,
  title = 'Glycemic Event Cluster Analysis',
}: ClusterEventsChartProps) {
  // Create a ref to hold the ReactECharts component instance
  const chartRef = useRef<ReactECharts>(null);

  // Process the entries data (memoized for performance)
  const processedEntries = useMemo(() => {
    const processed = processEntries(entries);
    // Optional: Add console logging for debugging if needed
    // console.log('Processed entries for cluster chart:', {
    //   totalReadings: processed.length,
    //   firstReading: processed.length > 0 ? processed[0].dateString : 'none',
    //   lastReading: processed.length > 0 ? processed[processed.length - 1].dateString : 'none'
    // });
    return processed;
  }, [entries]);

  // Helper function to format glucose values based on units
  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') {
      return 'N/A';
    }
    const fixedDecimals = units === 'mmol/L' ? 1 : 0;
    return value.toFixed(fixedDecimals);
  };

  // Calculate time window and generate series data (memoized)
  const getTimeWindowData = useMemo(() => {
    // Use a common reference date (today at midnight) to normalize all events
    const referenceDate = new Date();
    referenceDate.setHours(0, 0, 0, 0);

    // Function to normalize a timestamp to reference date while preserving time of day
    const normalizeToReferenceDate = (timestamp: string): Date => {
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

    // Find the earliest start time and latest end time (time of day) across all events
    let earliestTimeOfDay = 24 * 60; // Max minutes in a day
    let latestTimeOfDay = 0; // Min minutes in a day
    cluster.events.forEach((event) => {
      const startDate = new Date(event.start_timestamp);
      const endDate = new Date(event.end_timestamp);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
      earliestTimeOfDay = Math.min(earliestTimeOfDay, startMinutes);
      latestTimeOfDay = Math.max(latestTimeOfDay, endMinutes);
    });

    // Define buffer times (in minutes) to show data before and after the event peak times
    const bufferBeforeMinutes = 60;
    const bufferAfterMinutes = 30;

    // Calculate the overall chart window start and end times based on earliest/latest event times + buffer
    const windowStartTime = new Date(referenceDate);
    windowStartTime.setMinutes(Math.max(0, earliestTimeOfDay - bufferBeforeMinutes)); // Don't go before midnight

    const windowEndTime = new Date(referenceDate);
    // Handle cases where the buffered end time might wrap around to the next day
    if (latestTimeOfDay + bufferAfterMinutes >= 24 * 60) {
      windowEndTime.setDate(windowEndTime.getDate() + 1); // Move to next day
      windowEndTime.setMinutes((latestTimeOfDay + bufferAfterMinutes) % (24 * 60)); // Set minutes within the next day
    } else {
      windowEndTime.setMinutes(latestTimeOfDay + bufferAfterMinutes);
    }

    // Return early if there are no processed entries
    if (processedEntries.length === 0) {
      return { windowStartTime, windowEndTime, series: [], referenceDate };
    }

    // --- Generate Line Series ---
    const lineSeries = cluster.events.map((event, index) => {
      // Normalize event timestamps to the reference date
      const normalizedStartTime = normalizeToReferenceDate(event.start_timestamp);
      const normalizedEndTime = normalizeToReferenceDate(event.end_timestamp);

      // Convert the event's extreme glucose value to the user's selected units
      const extremeGlucoseValue = units === 'mmol/L' ? event.extreme_bg_mgdl / MG_DL_PER_MMOL_L : event.extreme_bg_mgdl;

      // Get the original start date for display purposes (e.g., in series name)
      const originalStartDate = new Date(event.start_timestamp);
      const dateStr = originalStartDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      // Define the actual start and end times of this specific event
      const eventStartTime = new Date(event.start_timestamp);
      const eventEndTime = new Date(event.end_timestamp);

      // Calculate the buffered time window for fetching data points for this *specific* event
      const bufferStartTime = new Date(eventStartTime);
      bufferStartTime.setMinutes(eventStartTime.getMinutes() - bufferBeforeMinutes);
      const bufferEndTime = new Date(eventEndTime);
      bufferEndTime.setMinutes(eventEndTime.getMinutes() + bufferAfterMinutes);

      // Filter the processed glucose readings to get only those within this event's buffered window
      const eventGlucoseData = processedEntries
        .filter((g) => {
          const readingTime = new Date(g.dateString);
          return readingTime >= bufferStartTime && readingTime <= bufferEndTime;
        })
        .sort(
          (
            a,
            b, // Sort the filtered data points chronologically
          ) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime(),
        );

      // Transform the filtered glucose data into the format needed by ECharts series
      const eventData = eventGlucoseData.map((g) => {
        const originalTime = new Date(g.dateString);
        // Normalize the time of the data point to the reference date for plotting on the X-axis
        const normalizedTime = normalizeToReferenceDate(g.dateString);

        // Convert the glucose value of this data point to the user's selected units
        const glucoseValue = units === 'mmol/L' ? g.glucose / MG_DL_PER_MMOL_L : g.glucose;

        // Check if this data point falls within the actual event duration (not the buffer)
        const isInEventRange = originalTime >= eventStartTime && originalTime <= eventEndTime;

        // Return the data point object for the series
        return {
          // value: [X, Y] format required by ECharts; X is normalized time, Y is glucose in user units
          value: [normalizedTime.toISOString(), glucoseValue],
          // Include additional data for tooltips or custom interactions
          originalTime: originalTime, // The actual timestamp of the reading
          originalDateString: g.dateString, // Original ISO string
          originalGlucose: g.glucose, // Original glucose value (in mg/dL)
          glucoseInUserUnits: glucoseValue, // Glucose value converted to user units
          originalDateStr: originalTime.toLocaleDateString(undefined, {
            // Formatted date string for this point
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          duration: event.duration_minutes, // Duration of the parent event
          extreme: extremeGlucoseValue, // Extreme glucose value for the parent event (in user units)
          extremeOriginal: event.extreme_bg_mgdl, // Original extreme glucose value (in mg/dL)
          eventType: event.event_type, // Type of the parent event (hypo/hyper)
          isInEventRange: isInEventRange, // Boolean flag if point is within event time
        };
      });

      // --- Line Series Configuration ---
      return {
        name: `Event ${index + 1} (${formatTime(event.start_timestamp)}, ${dateStr})`, // Series name for legend/tooltip
        type: 'line', // Chart type
        smooth: false, // Use straight line segments
        symbol: 'circle', // Shape of data points
        symbolSize: (val: any, params: any) => (params.data.isInEventRange ? 8 : 5), // Make points larger during the event (access data via params.data)
        lineStyle: {
          width: 2.5, // Default line thickness
          color: getEventColor(index), // Assign a unique color
        },
        // --- Emphasis: Styles applied when this series is hovered or highlighted ---
        emphasis: {
          focus: 'series', // Highlight this series, others go into 'blur' state
          lineStyle: {
            width: 5, // Make line significantly thicker on hover
          },
          itemStyle: {
            // Make data points stand out more
            borderWidth: 2,
            borderColor: '#FFF', // White border for contrast
          },
          z: 10, // Bring the hovered series to the front visually
        },
        // Style for individual data points (non-hovered state)
        itemStyle: {
          color: (params: any) => (params.data.isInEventRange ? getEventColor(index) : 'rgba(128, 128, 128, 0.5)'), // Color points inside the event range differently
          opacity: (params: any) => (params.data.isInEventRange ? 1 : 0.7), // Make points outside event slightly transparent
        },
        data: eventData, // The array of data points generated above
        id: `event-line-${index}`, // Unique ID for the series
      };
    }); // End of lineSeries map

    // --- Generate Background Area Series (one for each event) ---
    const backgroundSeries = cluster.events.map((event, index) => {
      // Normalize the start and end times for the background area
      const normalizedStartTime = normalizeToReferenceDate(event.start_timestamp);
      const normalizedEndTime = normalizeToReferenceDate(event.end_timestamp);

      // --- Background Series Configuration ---
      return {
        name: `Event ${index + 1} Background`, // Unique name for identification
        type: 'line', // Use 'line' type to define the x-axis range for markArea
        showSymbol: false, // No symbols needed
        silent: true, // Ignore mouse events
        zlevel: -1, // Draw behind data lines
        lineStyle: { opacity: 0 }, // Make the line invisible
        show: false, // Initially hidden - will be shown only on hover
        data: [
          [normalizedStartTime.toISOString(), 0],
          [normalizedEndTime.toISOString(), 0],
        ], // Dummy data spanning the time range
        // --- markArea: Defines the shaded background region ---
        markArea: {
          silent: true, // Area should not trigger mouse events
          itemStyle: {
            color: getEventTypeColor(event.event_type), // Base color based on event type
            opacity: 0.35, // Opacity is now constant - visibility controlled by series.show
          },
          data: [
            [
              // Define the area boundaries
              { xAxis: normalizedStartTime.toISOString() }, 
              { xAxis: normalizedEndTime.toISOString() }
            ],
          ],
        },
        tooltip: { show: false }, // No tooltip for background
        id: `event-background-${index}`, // Unique ID
      };
    }); // End of backgroundSeries map

    // Combine line and background series into one array
    const allSeries = [...lineSeries, ...backgroundSeries];

    return {
      windowStartTime,
      windowEndTime,
      series: allSeries,
      referenceDate,
    };
    // Dependencies for useMemo: rerun if cluster, entries, or units change
  }, [cluster, processedEntries, units]);

  // --- Define Clinical and Patient Thresholds ---
  const clinicalLow = units === 'mmol/L' ? 3.9 : 70;
  const clinicalHigh = units === 'mmol/L' ? 10 : 180;
  const adjustedPatientLowGoal =
    patientLowGoal && units === 'mmol/L' ? patientLowGoal / MG_DL_PER_MMOL_L : patientLowGoal;
  const adjustedPatientHighGoal =
    patientHighGoal && units === 'mmol/L' ? patientHighGoal / MG_DL_PER_MMOL_L : patientHighGoal;

  // --- Render Placeholder if No Data ---
  if (cluster.events.length === 0 || getTimeWindowData.series.length === 0 || processedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No event data available for this cluster.</p>
      </div>
    );
  }

  // --- ECharts Configuration Object ---
  const subtitle = 'Events from different days aligned by time of day';
  const options = {
    title: {
      text: title,
      subtext: subtitle,
      left: 'center',
      textStyle: { fontWeight: 'normal', fontSize: 16 },
      subtextStyle: { fontSize: 12, color: '#888' },
    },
    tooltip: {
      trigger: 'axis', // Show tooltip when hovering over the x-axis area
      formatter: (params: any[]) => {
        // Custom tooltip formatter
        if (!params || params.length === 0) return '';
        const firstItem = params[0];
        if (!firstItem?.value?.[0]) return ''; // Ensure data structure is valid

        // Get time from the hovered point
        const normalizedTime = new Date(firstItem.value[0]);
        const formattedTime = normalizedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        let content = `<div style="font-weight: bold; margin-bottom: 8px;">Time: ${formattedTime}</div>`;

        // Iterate through all series data points at this time position
        params.forEach((param) => {
          // Only include line series (skip backgrounds) and ensure data exists
          if (param.seriesName && !param.seriesName.includes('Background') && param.data) {
            const glucoseValue =
              param.data.glucoseInUserUnits ?? (Array.isArray(param.data.value) ? param.data.value[1] : null);

            if (glucoseValue !== null && typeof glucoseValue !== 'undefined') {
              // Extract event number or use full name as fallback
              const match = param.seriesName.match(/Event (\d+)/);
              const eventLabel = match ? `Event ${match[1]}` : param.seriesName;

              content += `<div style="margin-bottom: 4px;">
                  <span style="display:inline-block;margin-right:6px;border-radius:10px;width:8px;height:8px;background-color:${param.color};"></span>
                  ${eventLabel}: ${formatValue(glucoseValue)} ${units}
                  </div>`;
            }
          }
        });
        return content;
      },
    },
    grid: {
      // Padding around the chart area
      left: '3%',
      right: '4%',
      bottom: '20%',
      containLabel: true,
    },
    xAxis: {
      type: 'time', // X-axis represents time
      boundaryGap: false, // Start and end exactly at min/max
      min: getTimeWindowData.windowStartTime.toISOString(), // Calculated start time
      max: getTimeWindowData.windowEndTime.toISOString(), // Calculated end time
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        // Format time labels on the axis
        formatter: (value: number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      axisPointer: {
        // Configure the vertical line/label that follows the mouse
        label: {
          formatter: (params: any) =>
            new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      },
    },
    yAxis: {
      type: 'value', // Y-axis represents glucose value
      name: `Glucose (${units})`, // Axis title
      nameLocation: 'middle',
      nameGap: 50, // Space between title and axis
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed' } }, // Dashed horizontal grid lines
      // Consider setting min/max based on data range or clinical goals if needed
      // min: 0,
      // max: units === 'mmol/L' ? 22 : 400
    },
    // Define all series (lines, backgrounds, thresholds)
    series: [
      ...getTimeWindowData.series, // Spread the generated line and background series
      // --- Threshold Lines (using markLine for simplicity) ---
      {
        name: 'Clinical Low',
        type: 'line',
        data: [],
        tooltip: { show: false },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1 },
          label: { show: true, position: 'end', formatter: 'Low' },
          data: [{ yAxis: clinicalLow }],
        },
      },
      {
        name: 'Clinical High',
        type: 'line',
        data: [],
        tooltip: { show: false },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1 },
          label: { show: true, position: 'end', formatter: 'High' },
          data: [{ yAxis: clinicalHigh }],
        },
      },
      // Conditionally add patient goal lines
      ...(adjustedPatientLowGoal
        ? [
            {
              name: 'Patient Low Goal',
              type: 'line',
              data: [],
              tooltip: { show: false },
              markLine: {
                silent: true,
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
                label: { show: true, position: 'end', formatter: 'Target Low' },
                data: [{ yAxis: adjustedPatientLowGoal }],
              },
            },
          ]
        : []),
      ...(adjustedPatientHighGoal
        ? [
            {
              name: 'Patient High Goal',
              type: 'line',
              data: [],
              tooltip: { show: false },
              markLine: {
                silent: true,
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
                label: { show: true, position: 'end', formatter: 'Target High' },
                data: [{ yAxis: adjustedPatientHighGoal }],
              },
            },
          ]
        : []),
    ],
    legend: {
      type: 'scroll', // Allow scrolling if many events
      orient: 'horizontal',
      bottom: 35, // Position below x-axis
      // Show only line series names in the legend
      data: getTimeWindowData.series.filter((s) => s.name && !s.name.includes('Background')).map((s) => s.name!), // Use non-null assertion after filtering
      // Initially select all line series
      selected: getTimeWindowData.series
        .filter((s) => s.name && !s.name.includes('Background'))
        .reduce(
          (acc, series) => {
            acc[series.name!] = true;
            return acc;
          },
          {} as Record<string, boolean>,
        ),
      selectedMode: 'multiple', // Allow toggling multiple series
    },
    // --- Interaction and Highlighting Configuration ---
    highlightPolicy: 'series', // Hovering highlights the entire series
    emphasis: {
      focus: 'series', // Highlight hovered series, blur others
      scale: false, // Disable scaling effect on hover
    },
    animation: false, // Disable animations for instant feedback
    // --- Blur State: Styles for non-highlighted series ---
    blur: {
      lineStyle: {
        color: '#DDDDDD', // Light grey for blurred lines
        width: 1, // Thin blurred lines
        opacity: 0.6, // Make blurred lines slightly transparent
      },
      itemStyle: {
        color: '#DDDDDD', // Light grey for blurred points
        opacity: 0.6, // Match line opacity
      },
      // areaStyle removed here - opacity controlled manually
    },
  };

  // --- Render the Chart Component ---
  return (
    <div className="w-full h-[450px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <ReactECharts
        ref={chartRef} // Assign the ref
        option={options} // Pass the configuration object
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // Use SVG renderer for better quality
        // --- Event Handlers for Hover Effects ---
        onEvents={{
          // --- Mouse Over Event Handler ---
          mouseover: (params: any) => {
            if (!chartRef.current) return;

            const echartsInstance = chartRef.current.getEchartsInstance();

            // First, hide all background areas
            hideAllBackgrounds(echartsInstance);

            // For debugging
            // console.log("Hover params:", params);

            // Determine which event is being hovered
            let eventNumber = -1;

            if (Array.isArray(params)) {
              // When hovering on a marker, params is an array
              for (const param of params) {
                if (param.seriesName && !param.seriesName.includes('Background')) {
                  const match = param.seriesName.match(/Event (\d+)/);
                  if (match) {
                    eventNumber = parseInt(match[1]);
                    break;
                  }
                }
              }
            } else if (params.seriesName && !params.seriesName.includes('Background')) {
              // When hovering on a line segment, params is a single object
              const match = params.seriesName.match(/Event (\d+)/);
              if (match) {
                eventNumber = parseInt(match[1]);
              }
            }

            // If we found a valid event number, show its background
            if (eventNumber > 0) {
              showBackgroundForEvent(echartsInstance, eventNumber);
            }
          },
          // --- Global Out Event Handler (mouse leaves chart area) ---
          globalout: () => {
            if (!chartRef.current) return;
            const echartsInstance = chartRef.current.getEchartsInstance();
            // Hide all background areas when mouse leaves chart
            hideAllBackgrounds(echartsInstance);
          },
        }} // End of onEvents
      />
    </div>
  );
}
