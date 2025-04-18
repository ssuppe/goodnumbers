'use client';

// --- Imports ---
import * as React from 'react';
import { useRef, useMemo } from 'react';
import { GlucoseUnits, NightscoutEntry, NightscoutTreatment } from '@/types/nightscout';
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
  /**
   * Optional array of Nightscout treatments to display meal events as a bar chart.
   * When provided, the chart will show a subplot with carb values from treatments.
   */
  treatments?: NightscoutTreatment[];
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

/**
 * Process treatments data to format for chart display
 * Filter to relevant treatments (with carbs > 0) and sort by date
 */
function processTreatments(treatments: NightscoutTreatment[] | undefined): {
  dateString: string;
  carbs: number;
  notes: string | null;
  eventType: string;
}[] {
  if (!treatments || treatments.length === 0) return [];

  // Filter for treatments with carbs > 0
  const carbTreatments = treatments.filter((t) => t.carbs && t.carbs > 0);

  // Sort by date
  const sortedTreatments = [...carbTreatments].sort((a, b) => a.date - b.date);

  // Map to simplified format
  return sortedTreatments.map((treatment) => ({
    dateString: new Date(treatment.date).toISOString(),
    carbs: treatment.carbs || 0,
    notes: treatment.notes || null,
    eventType: treatment.eventType,
  }));
}

/**
 * Maps treatments to events based on timestamp matching
 * Takes into account both time of day and calendar date
 * Returns treatments grouped by event index
 */
function mapTreatmentsToEvents(
  processedTreatments: ReturnType<typeof processTreatments>,
  cluster: TimeCluster,
  bufferBeforeMinutes: number = 60,
  bufferAfterMinutes: number = 30,
): Record<number, ReturnType<typeof processTreatments>> {
  const treatmentsByEvent: Record<number, ReturnType<typeof processTreatments>> = {};

  // Initialize empty arrays for each event
  cluster.events.forEach((_, index) => {
    treatmentsByEvent[index] = [];
  });

  // For each treatment, find which event it belongs to
  processedTreatments.forEach((treatment) => {
    const treatmentDate = new Date(treatment.dateString);
    const treatmentDay = treatmentDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format

    // Find the event this treatment falls into
    for (let i = 0; i < cluster.events.length; i++) {
      const event = cluster.events[i];
      const eventStartDate = new Date(event.start_timestamp);
      const eventEndDate = new Date(event.end_timestamp);
      const eventDay = eventStartDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format

      // Check if the treatment is on the same day as the event
      if (treatmentDay === eventDay) {
        // Define a buffer around the event (same as for glucose data)
        const bufferStartTime = new Date(eventStartDate);
        bufferStartTime.setMinutes(eventStartDate.getMinutes() - bufferBeforeMinutes);

        const bufferEndTime = new Date(eventEndDate);
        bufferEndTime.setMinutes(eventEndDate.getMinutes() + bufferAfterMinutes);

        // If the treatment falls within this event's time range (with buffer)
        if (treatmentDate >= bufferStartTime && treatmentDate <= bufferEndTime) {
          treatmentsByEvent[i].push(treatment);
          break; // Treatment assigned to an event, move to next treatment
        }
      }
    }
  });

  return treatmentsByEvent;
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
  treatments,
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Effect to refresh chart when needed
  React.useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart) {
      chart.resize();
    }
    // Dependency array includes props that might change chart dimensions or content
  }, [cluster, entries, units, patientLowGoal, patientHighGoal, title, treatments]);

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

    // Calculate the earliest and latest times across all events to determine window
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

    // ---- MEAL DATA PROCESSING ----
    // Process treatments data if available, otherwise use empty array
    const processedTreatments = treatments ? processTreatments(treatments) : [];

    // Map treatments to their corresponding events by date and time
    const treatmentsByEvent = mapTreatmentsToEvents(
      processedTreatments,
      cluster,
      bufferBeforeMinutes,
      bufferAfterMinutes,
    );

    // Determine if we have any valid meal data to display
    const hasMealData = processedTreatments.length > 0;

    // Handle empty data case
    if (processedEntries.length === 0) {
      // Return a default range if no entries to avoid chart errors
      const defaultStart = new Date(referenceDate);
      defaultStart.setHours(0);
      const defaultEnd = new Date(referenceDate);
      defaultEnd.setHours(23, 59);
      return {
        windowStartTime: defaultStart,
        windowEndTime: defaultEnd,
        series: [],
        referenceDate,
        hasMealData: false,
        lineSeries: [],
        mealSeries: [],
      };
    }

    // ---- GLUCOSE LINE SERIES ----
    // Create the glucose line series (same as original with minor changes for consistency)
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

      // Filter and sort glucose data for this event
      const eventGlucoseData = processedEntries
        .filter((g) => {
          const readingTime = new Date(g.dateString);
          return readingTime >= bufferStartTimeOriginal && readingTime <= bufferEndTimeOriginal;
        })
        .sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());

      // Map glucose data to chart-friendly format
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

      // Configure glucose line series for this event
      return {
        name: `Event ${index + 1} (${formatTime(event.start_timestamp)}, ${dateStr})`,
        type: 'line',
        // When we have meal data, specify which grid to use
        ...(hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}),
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
      };
    });

    // ---- MEAL BAR SERIES ----
    // Create bar series for meals if available
    const mealSeries = hasMealData
      ? cluster.events
          .map((event, index) => {
            const eventVisuals = getEventVisuals(index);
            const eventTreatments = treatmentsByEvent[index] || [];

            // Skip events with no treatments by returning null
            // (we'll filter these out later)
            if (eventTreatments.length === 0) {
              return null;
            }

            // Map treatments to chart data format with normalized timestamps
            const mealData = eventTreatments.map((treatment) => {
              const originalTime = new Date(treatment.dateString);
              // Use the same normalization function as for glucose data
              const normalizedTime = normalizeToReferenceDate(treatment.dateString);

              return {
                // Basic value pair for ECharts [time, carbs]
                value: [normalizedTime.toISOString(), treatment.carbs],
                // Additional metadata for tooltips and interaction
                originalTime,
                originalDateString: treatment.dateString,
                originalCarbs: treatment.carbs,
                notes: treatment.notes,
                eventType: treatment.eventType,
                originalDateStr: originalTime.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }),
              };
            });

            // Configure meal bar series for this event
            return {
              name: `Event ${index + 1} Meals`,
              type: 'bar',
              xAxisIndex: 1, // Use secondary x-axis (for meal chart)
              yAxisIndex: 1, // Use secondary y-axis (for carb values)
              itemStyle: {
                // Use the same color as the glucose series for this event
                color: eventVisuals.color,
                opacity: 0.8,
              },
              emphasis: {
                focus: 'series',
                itemStyle: {
                  opacity: 1,
                },
              },
              data: mealData,
              barWidth: '50%', // Make bars wider
              barGap: '-50%', // Space between bars
              z: 10, // Higher z-index to ensure visibility
            };
          })
          .filter(Boolean)
      : []; // Filter out null entries for events with no meals

    // ---- COMBINE SERIES ----
    // Combine glucose line series and meal bar series
    const allSeries = [...lineSeries, ...mealSeries];

    // Return both data series and metadata
    return {
      windowStartTime,
      windowEndTime,
      series: allSeries,
      referenceDate,
      hasMealData, // Flag indicating if meal data is available
      lineSeries, // Line series for glucose data
      mealSeries, // Bar series for meal data
    };
  }, [cluster, processedEntries, units, treatments]); // Include treatments in dependency array

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
  const allGlucoseValues = getTimeWindowData.lineSeries.flatMap((s) => s.data.map((d: any) => d.value[1]));
  // Include goal lines in min/max calculation to ensure they are visible
  const minDataValue = Math.min(...allGlucoseValues, adjustedPatientLowGoal ?? Infinity, clinicalLow);
  const maxDataValue = Math.max(...allGlucoseValues, adjustedPatientHighGoal ?? -Infinity, clinicalHigh);

  // Determine Y-axis min/max - add padding for readability
  // Ensure min is not too low (e.g., below 0 or a sensible physical minimum)
  const yAxisMin = Math.max(0, Math.floor(minDataValue * 0.9)); // 10% buffer below min data, min 0
  const yAxisMax = Math.ceil(maxDataValue * 1.1); // 10% buffer above max data

  // Calculate max carbs value for carbs axis scaling when meal data is present
  const maxCarbsValue =
    getTimeWindowData.hasMealData && getTimeWindowData.mealSeries.length > 0
      ? Math.max(
          ...getTimeWindowData.mealSeries.filter((s) => s !== null).flatMap((s) => s.data.map((d: any) => d.value[1])),
          50, // Ensure a minimum reasonable scale for carbs
        )
      : 0;
  const carbsAxisMax = Math.ceil(maxCarbsValue * 1.2); // 20% buffer above max carbs

  const options = {
    // --- Chart options ---
    // Title is often managed by the parent component's structure, set to null here
    title: {
      text: null,
      subtext: null,
    },

    // ---- TOOLTIP CONFIGURATION ----
    tooltip: {
      // Use 'axis' trigger when meal data is present to show both glucose and carbs at same time point
      trigger: getTimeWindowData.hasMealData ? 'axis' : 'item',
      // Add axis pointer for cross-hairs when meal data is present
      axisPointer: getTimeWindowData.hasMealData
        ? {
            type: 'cross',
            link: { xAxisIndex: 'all' }, // Link all x-axes for synchronized highlighting
          }
        : undefined,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderWidth: 1,
      padding: 12,
      textStyle: {
        fontSize: 13,
        lineHeight: 20,
        color: '#333',
      },
      // Enhanced formatter to handle both glucose and meal data
      formatter: (params: any) => {
        // Handle array of params when using axis trigger
        const paramsArray = Array.isArray(params) ? params : [params];

        // Check if we have valid params
        if (!paramsArray.length || !paramsArray[0].data || !paramsArray[0].data.value) {
          return null;
        }

        // Get time info from the first parameter
        const normalizedTime = new Date(paramsArray[0].data.value[0]);
        const formattedTime = normalizedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        // Start tooltip content with time
        let content = `<div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 6px;">Time: ${formattedTime}</div>`;

        // Group params by series type (glucose vs meal)
        const glucoseData = paramsArray.filter(
          (p) => p.seriesType === 'line' && p.data.glucoseInUserUnits !== undefined,
        );
        const mealData = paramsArray.filter((p) => p.seriesType === 'bar' && p.data.originalCarbs !== undefined);

        // Add glucose data
        if (glucoseData.length > 0) {
          glucoseData.forEach((param) => {
            // Extract event label from series name
            const match = param.seriesName.match(/Event (\d+)/);
            const eventLabel = match ? `Event ${match[1]}` : param.seriesName;

            // Add date info if available
            const dateInfo = param.data.originalDateStr
              ? `<div style="margin-bottom: 4px;">Date: ${param.data.originalDateStr}</div>`
              : '';

            // Get glucose value formatted with units
            const glucoseValueFormatted = `${formatValue(param.data.glucoseInUserUnits)} ${units}`;

            // Add glucose info
            content += `${dateInfo}`;
            content += `<div style="margin-bottom: 6px;"><span style="display:inline-block;margin-right:8px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span><span style="font-weight: 500;">${eventLabel}:</span> <span style="margin-left: 5px; font-weight: bold;">${glucoseValueFormatted}</span></div>`;

            // Include event type and duration if available
            const eventTypeInfo = param.data.eventType
              ? `<div style="margin-bottom: 4px;">Type: ${getEventTypeName(param.data.eventType)}</div>`
              : '';
            const durationInfo = param.data.duration
              ? `<div style="margin-bottom: 4px;">Duration: ${param.data.duration} min</div>`
              : '';

            content += `${eventTypeInfo}${durationInfo}`;
          });
        }

        // Add meal data
        if (mealData.length > 0) {
          // Add separator if we already have glucose data
          if (glucoseData.length > 0) {
            content += `<div style="margin: 8px 0; border-top: 1px dotted #ddd; padding-top: 8px;"></div>`;
          }

          mealData.forEach((param) => {
            // Extract event label from series name
            const match = param.seriesName.match(/Event (\d+)/);
            const eventLabel = match ? `Event ${match[1]}` : param.seriesName;

            // Get carb value
            const carbsValueFormatted = `${param.data.originalCarbs} g`;

            // Add meal info
            content += `<div style="margin-bottom: 6px;"><span style="display:inline-block;margin-right:8px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span><span style="font-weight: 500;">${eventLabel} Meal:</span> <span style="margin-left: 5px; font-weight: bold;">${carbsValueFormatted}</span></div>`;

            // Add notes if available
            if (param.data.notes) {
              content += `<div style="margin-bottom: 4px; font-style: italic;">"${param.data.notes}"</div>`;
            }

            // Add meal type if available
            if (param.data.eventType) {
              content += `<div style="margin-bottom: 4px;">Type: ${param.data.eventType}</div>`;
            }
          });
        }

        return content;
      },
      extraCssText: 'box-shadow: 0 3px 14px rgba(0,0,0,0.15); border-radius: 6px;',
    },

    // ---- GRID CONFIGURATION ----
    // Dynamic grid configuration based on whether meal data is present
    grid: getTimeWindowData.hasMealData
      ? [
          {
            // Top grid for glucose chart (when meal data is present)
            left: 70,
            right: 30,
            top: 20,
            bottom: '45%', // Leave 45% of space at bottom for meal chart and legend (increased from 35%)
            containLabel: true,
          },
          {
            // Bottom grid for meal chart
            left: 70,
            right: 30,
            top: '60%', // Start at 60% from top (decreased from 70%)
            bottom: 100, // Leave space for legend at bottom
            containLabel: true,
          },
        ]
      : {
          // Single grid when no meal data (same as original)
          left: 70,
          right: 30,
          top: 20,
          bottom: 100,
          containLabel: true,
        },

    // ---- X-AXIS CONFIGURATION ----
    // Configure x-axes based on whether meal data is present
    xAxis: getTimeWindowData.hasMealData
      ? [
          {
            // Primary x-axis for glucose chart
            gridIndex: 0,
            type: 'time',
            boundaryGap: false,
            min: getTimeWindowData.windowStartTime.toISOString(),
            max: getTimeWindowData.windowEndTime.toISOString(),
            axisLine: { show: true, lineStyle: { color: '#ccc' } },
            axisTick: { show: true, lineStyle: { color: '#ccc' } },
            axisLabel: {
              formatter: (value: number) =>
                new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              color: '#333',
              textStyle: { fontSize: 12 },
              show: false, // Hide label for top axis to avoid clutter
            },
            axisPointer: {
              label: {
                formatter: (params: any) =>
                  new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            },
          },
          {
            // Secondary x-axis for meal chart (bottom)
            gridIndex: 1,
            type: 'time',
            boundaryGap: false,
            min: getTimeWindowData.windowStartTime.toISOString(),
            max: getTimeWindowData.windowEndTime.toISOString(),
            axisLine: { show: true, lineStyle: { color: '#ccc' } },
            axisTick: { show: true, lineStyle: { color: '#ccc' } },
            axisLabel: {
              formatter: (value: number) =>
                new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              color: '#333',
              textStyle: { fontSize: 12 },
            },
            axisPointer: {
              link: { xAxisIndex: 'all' }, // Link all x-axes together
              label: {
                formatter: (params: any) =>
                  new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            },
          },
        ]
      : {
          // Original single x-axis configuration when no meal data
          type: 'time',
          boundaryGap: false,
          min: getTimeWindowData.windowStartTime.toISOString(),
          max: getTimeWindowData.windowEndTime.toISOString(),
          axisLine: { show: true, lineStyle: { color: '#ccc' } },
          axisTick: { show: true, lineStyle: { color: '#ccc' } },
          axisLabel: {
            formatter: (value: number) =>
              new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            color: '#333',
            textStyle: { fontSize: 12 },
          },
          axisPointer: {
            label: {
              formatter: (params: any) =>
                new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          },
        },

    // ---- Y-AXIS CONFIGURATION ----
    // Configure y-axes based on whether meal data is present
    yAxis: getTimeWindowData.hasMealData
      ? [
          {
            // Primary y-axis for glucose values (top chart)
            gridIndex: 0,
            type: 'value',
            name: `Glucose (${units})`,
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: '#333',
            },
            min: yAxisMin,
            max: yAxisMax,
            axisLabel: {
              formatter: (value: number) => formatValue(value),
              color: '#333',
              textStyle: { fontSize: 12 },
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: {
              show: true,
              lineStyle: {
                type: 'dashed',
                opacity: 0.4,
              },
            },
          },
          {
            // Secondary y-axis for carb values (bottom chart)
            gridIndex: 1,
            type: 'value',
            name: 'Carbs (g)',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: {
              fontSize: 14,
              fontWeight: 'bold',
              color: '#333',
            },
            min: 0,
            max: carbsAxisMax > 0 ? carbsAxisMax : 100, // Use calculated max or default to 100
            axisLabel: {
              formatter: (value: number) => value.toFixed(0),
              color: '#333',
              textStyle: { fontSize: 12 },
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: {
              show: true,
              lineStyle: {
                type: 'dashed',
                opacity: 0.4,
              },
            },
          },
        ]
      : {
          // Original single y-axis configuration when no meal data
          type: 'value',
          name: `Glucose (${units})`,
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: {
            fontSize: 14,
            fontWeight: 'bold',
            color: '#333',
            padding: [0, 0, 0, 0],
          },
          min: yAxisMin,
          max: yAxisMax,
          axisLabel: {
            formatter: (value: number) => formatValue(value),
            color: '#333',
            textStyle: { fontSize: 12 },
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: {
            show: true,
            lineStyle: {
              type: 'dashed',
              opacity: 0.4,
            },
          },
        },

    // ---- SERIES CONFIGURATION ----
    series: [
      /* Data series generated in getTimeWindowData */
      ...getTimeWindowData.series,

      /* Mark lines for clinical ranges */
      // Add grid indices to markLines when meal data is present
      {
        name: 'Clinical Low',
        type: 'line', // Needs to be a line type for markLine to work
        ...(getTimeWindowData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}), // Only add to glucose chart
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
        ...(getTimeWindowData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}), // Only add to glucose chart
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
              ...(getTimeWindowData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}), // Only add to glucose chart
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
              ...(getTimeWindowData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}), // Only add to glucose chart
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
      // Include both glucose and meal series in legend
      data: [
        ...getTimeWindowData.lineSeries.map((s) => s.name!),
        ...(getTimeWindowData.hasMealData
          ? getTimeWindowData.mealSeries.filter((s) => s !== null).map((s) => s.name!)
          : []),
      ],
      // Set initial visibility state for all series
      selected: [
        ...getTimeWindowData.lineSeries.map((s) => ({ [s.name!]: true })),
        ...(getTimeWindowData.hasMealData
          ? getTimeWindowData.mealSeries.filter((s) => s !== null).map((s) => ({ [s.name!]: true }))
          : []),
      ].reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      selectedMode: 'multiple', // Allow selecting/deselecting multiple series
    },
    // Highlight configuration - link highlighting across both charts
    highlightPolicy: 'series', // Highlight the whole series on hover
    emphasis: {
      focus: 'series',
      scale: false, // Don't scale the series on hover, just change style
    },
    // Add axis pointer linking for synchronized highlighting
    axisPointer: getTimeWindowData.hasMealData
      ? {
          link: { xAxisIndex: 'all' },
        }
      : undefined,
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
