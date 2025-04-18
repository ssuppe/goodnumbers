'use client';

// --- Imports ---
import * as React from 'react';
import { useRef, useMemo, useEffect } from 'react'; // Added useEffect
import { GlucoseUnits, NightscoutEntry, NightscoutTreatment } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
import { EChartsOption, ECElementEvent } from 'echarts'; // Import ECharts types
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

function processTreatments(treatments: NightscoutTreatment[] | undefined): {
  dateString: string;
  carbs: number;
  notes: string | null;
  eventType: string;
}[] {
  if (!treatments || treatments.length === 0) return [];
  const carbTreatments = treatments.filter((t) => t.carbs && t.carbs > 0);
  const sortedTreatments = [...carbTreatments].sort((a, b) => a.date - b.date);
  return sortedTreatments.map((treatment) => ({
    dateString: new Date(treatment.date).toISOString(),
    carbs: treatment.carbs || 0,
    notes: treatment.notes || null,
    eventType: treatment.eventType,
  }));
}

function mapTreatmentsToEvents(
  processedTreatments: ReturnType<typeof processTreatments>,
  cluster: TimeCluster,
  bufferBeforeMinutes: number = 60,
  bufferAfterMinutes: number = 30,
): Record<number, ReturnType<typeof processTreatments>> {
  const treatmentsByEvent: Record<number, ReturnType<typeof processTreatments>> = {};
  cluster.events.forEach((_, index) => {
    treatmentsByEvent[index] = [];
  });

  processedTreatments.forEach((treatment) => {
    const treatmentDate = new Date(treatment.dateString);
    const treatmentDay = treatmentDate.toISOString().split('T')[0];

    for (let i = 0; i < cluster.events.length; i++) {
      const event = cluster.events[i];
      const eventStartDate = new Date(event.start_timestamp);
      const eventEndDate = new Date(event.end_timestamp);
      const eventDay = eventStartDate.toISOString().split('T')[0];

      if (treatmentDay === eventDay) {
        const bufferStartTime = new Date(eventStartDate);
        bufferStartTime.setMinutes(eventStartDate.getMinutes() - bufferBeforeMinutes);
        const bufferEndTime = new Date(eventEndDate);
        bufferEndTime.setMinutes(eventEndDate.getMinutes() + bufferAfterMinutes);

        if (treatmentDate >= bufferStartTime && treatmentDate <= bufferEndTime) {
          treatmentsByEvent[i].push(treatment);
          break;
        }
      }
    }
  });

  return treatmentsByEvent;
}

// Define colors and line styles
const eventColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
const lineStyleTypes = ['solid', 'dashed', 'dotted'];

// Function to get visual properties based on event index, ensuring color consistency
function getEventVisuals(index: number): { color: string; lineType: string } {
  return {
    color: eventColors[index % eventColors.length],
    lineType: lineStyleTypes[Math.floor(index / eventColors.length) % lineStyleTypes.length], // Cycle line styles after colors repeat
  };
}

function formatTime(dateString: string | number | Date): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Extracts the day part of a date in YYYY-MM-DD format
 */
function extractDay(dateString: string | number | Date): string {
  try {
    // Handle potential invalid date strings gracefully
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // console.warn(`Invalid date string encountered in extractDay: ${dateString}`);
      return 'unknown-day';
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    // console.error(`Error parsing date in extractDay: ${dateString}`, error);
    return 'unknown-day';
  }
}

/**
 * Extracts the event index (0-based) from a series name or ID.
 * Example names: "Event 1 (...", "Event 1 Meals"
 * Example IDs: "glucose-event-0", "carb-event-0"
 */
const extractEventIndex = (input: string | undefined): number | null => {
  if (!input) return null;

  // Try extracting from "Event X ..." or "Event X Meals" format in name
  const nameMatch = input.match(/^Event (\d+)/);
  if (nameMatch) {
    return parseInt(nameMatch[1], 10) - 1; // Convert to zero-based index
  }

  // Try extracting from ID format "type-event-X"
  const idMatch = input.match(/(?:glucose|carb)-event-(\d+)/);
  if (idMatch) {
    return parseInt(idMatch[1], 10); // Already zero-based
  }

  // console.warn(`Could not extract event index from input: ${input}`);
  return null;
};

// --- Main Component ---

export function ClusterEventsChart({
  cluster,
  entries,
  units,
  patientLowGoal,
  patientHighGoal,
  title = 'Glycemic Event Cluster Analysis', // Default title (can be overridden)
  treatments,
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Process glucose entries (memoized for performance)
  const processedEntries = useMemo(() => processEntries(entries), [entries]);

  // Prepare data for ECharts (memoized for performance)
  const chartData = useMemo(() => {
    // --- Time Window Calculation ---
    const referenceDate = new Date();
    referenceDate.setHours(0, 0, 0, 0); // Normalize to start of an arbitrary day

    // Function to normalize a timestamp to the reference date's time-of-day
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

    // Determine the overall time window needed based on all events
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

    const bufferBeforeMinutes = 60;
    const bufferAfterMinutes = 30;

    const windowStartTime = new Date(referenceDate);
    windowStartTime.setMinutes(Math.max(0, earliestTimeOfDay - bufferBeforeMinutes));

    const windowEndTime = new Date(referenceDate);
    const proposedEndMinutes = latestTimeOfDay + bufferAfterMinutes;

    // Handle potential midnight crossing for the window
    if (proposedEndMinutes >= 24 * 60) {
      windowEndTime.setDate(windowEndTime.getDate() + 1);
      windowEndTime.setMinutes(proposedEndMinutes % (24 * 60));
    } else {
      windowEndTime.setMinutes(proposedEndMinutes);
    }

    // --- Meal Data Processing (if treatments are provided) ---
    const processedTreatments = treatments ? processTreatments(treatments) : [];
    const treatmentsByEvent = mapTreatmentsToEvents(
      processedTreatments,
      cluster,
      bufferBeforeMinutes,
      bufferAfterMinutes,
    );
    const hasMealData = processedTreatments.length > 0;

    // --- Series Generation ---

    // Helper function to create common data point properties
    const createDataPoint = (
      originalTimestamp: string | number,
      value: number | [string | number, number],
      type: 'glucose' | 'carbs',
      eventIndex: number,
      additionalProps: Record<string, any> = {},
    ): Record<string, any> => {
      const originalTime = new Date(originalTimestamp);
      const normalizedTime = normalizeToReferenceDate(originalTimestamp);
      const day = extractDay(originalTimestamp);

      return {
        value: Array.isArray(value)
          ? [normalizedTime.toISOString(), value[1]] // Use normalized time for plotting
          : [normalizedTime.toISOString(), value], // Assume value is the Y-value if not array
        originalTime,
        originalDateString: originalTimestamp,
        originalDateStr: originalTime.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        eventIndex, // Store the 0-based index of the parent event
        day, // Store the specific day (YYYY-MM-DD)
        seriesType: type, // Store the type ('glucose' or 'carbs')
        ...additionalProps, // Include any type-specific props
      };
    };

    // Generate Glucose Line Series
    const lineSeries = cluster.events.map((event, index) => {
      const eventVisuals = getEventVisuals(index);
      const originalStartDate = new Date(event.start_timestamp);
      const dateStr = originalStartDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      // Define the specific time range for this event instance (including buffers)
      const eventStartTimeOriginal = new Date(event.start_timestamp);
      const eventEndTimeOriginal = new Date(event.end_timestamp);
      const bufferStartTimeOriginal = new Date(eventStartTimeOriginal);
      bufferStartTimeOriginal.setMinutes(eventStartTimeOriginal.getMinutes() - bufferBeforeMinutes);
      const bufferEndTimeOriginal = new Date(eventEndTimeOriginal);
      bufferEndTimeOriginal.setMinutes(eventEndTimeOriginal.getMinutes() + bufferAfterMinutes);

      // Filter glucose data relevant to this event instance's time window
      const eventGlucoseData = processedEntries
        .filter((g) => {
          const readingTime = new Date(g.dateString);
          return readingTime >= bufferStartTimeOriginal && readingTime <= bufferEndTimeOriginal;
        })
        .sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());

      // Map filtered glucose data to ECharts format
      const eventData = eventGlucoseData.map((g) => {
        const glucoseValue = units === 'mmol/L' ? g.glucose / MG_DL_PER_MMOL_L : g.glucose;
        const originalTime = new Date(g.dateString);
        const isInEventRange = originalTime >= eventStartTimeOriginal && originalTime <= eventEndTimeOriginal;

        return createDataPoint(g.dateString, glucoseValue, 'glucose', index, {
          originalGlucose: g.glucose,
          glucoseInUserUnits: glucoseValue,
          duration: event.duration_minutes,
          extreme: units === 'mmol/L' ? event.extreme_bg_mgdl / MG_DL_PER_MMOL_L : event.extreme_bg_mgdl,
          extremeOriginal: event.extreme_bg_mgdl,
          eventType: event.event_type,
          isInEventRange, // Flag points within the core event time
        });
      });

      return {
        name: `Event ${index + 1} (${dateStr}, ${formatTime(event.start_timestamp)})`,
        id: `glucose-event-${index}`, // Unique ID including index
        type: 'line',
        ...(hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}), // Assign to top grid if meals shown
        smooth: false, // Keep medical data non-smoothed
        symbol: 'circle',
        symbolSize: (val: any, params: any) => (params.data.isInEventRange ? 6 : 2),
        showSymbol: true,
        lineStyle: {
          width: 2,
          color: eventVisuals.color, // Use consistent color
          type: eventVisuals.lineType, // Use consistent line style
        },
        itemStyle: {
          // Style for the data points themselves
          color: (params: any) => (params.data.isInEventRange ? eventVisuals.color : 'rgba(170, 170, 170, 0.6)'),
          opacity: (params: any) => (params.data.isInEventRange ? 1 : 0.7),
        },
        emphasis: {
          // Style on hover (when series is highlighted)
          focus: 'series', // Enables blur effect on others
          lineStyle: { width: 4 },
          itemStyle: { borderWidth: 2, borderColor: '#fff' },
        },
        blur: {
          // Style when another series is highlighted
          lineStyle: { opacity: 0.2, color: '#ccc' },
          itemStyle: { opacity: 0.2, color: '#ccc' },
        },
        data: eventData,
        z: 5, // Default z-level for data series
      };
    });

    // Generate Meal Bar Series (if data exists)
    const mealSeries = hasMealData
      ? cluster.events
          .map((event, index) => {
            const eventVisuals = getEventVisuals(index);
            const eventTreatments = treatmentsByEvent[index] || [];

            if (eventTreatments.length === 0) {
              return null; // Skip if no treatments for this event index
            }

            // Map treatments to ECharts bar format
            const mealData = eventTreatments.map((treatment) => {
              return createDataPoint(treatment.dateString, treatment.carbs, 'carbs', index, {
                originalCarbs: treatment.carbs,
                notes: treatment.notes,
                mealEventType: treatment.eventType, // Keep original eventType name distinct
              });
            });

            return {
              name: `Event ${index + 1} Meals`,
              id: `carb-event-${index}`, // Unique ID including index
              type: 'bar',
              xAxisIndex: 1, // Assign to bottom grid
              yAxisIndex: 1,
              itemStyle: {
                color: eventVisuals.color, // Use consistent color
                opacity: 0.8,
              },
              emphasis: {
                // Style on hover (when series is highlighted)
                focus: 'series',
                itemStyle: {
                  opacity: 1,
                  borderColor: '#fff',
                  borderWidth: 1,
                },
              },
              blur: {
                // Style when another series is highlighted
                itemStyle: { opacity: 0.2, color: '#ccc' },
              },
              barWidth: '60%', // Adjust bar width as needed
              data: mealData,
              z: 5, // Default z-level for data series
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null) // Filter out nulls and ensure type safety
      : [];

    const allSeries = [...lineSeries, ...mealSeries];

    return {
      windowStartTime,
      windowEndTime,
      series: allSeries,
      lineSeries,
      mealSeries,
      hasMealData,
    };
  }, [cluster, processedEntries, units, treatments]); // Dependencies for data processing

  // --- Effect for Chart Interaction (Highlighting Logic) ---
  useEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    // --- Highlight Handler ---
    // This function is triggered AFTER a mouseover causes a 'highlight' action.
    // It refines which series should *stay* highlighted vs. be downplayed.
    const handleHighlight = (...args: unknown[]) => {
      // --- Argument Validation and Casting ---
      // ECharts events might pass various arguments. We usually care about the first one.
      if (!args || args.length === 0 || typeof args[0] !== 'object' || args[0] === null) {
        // console.warn("Highlight event received invalid or no arguments.");
        return; // No valid argument object found
      }
      // Safely cast the first argument to the expected event parameter type.
      // Note: ECElementEvent might not cover *all* properties sometimes passed,
      // but it's the most relevant type for component interactions.
      const params = args[0] as ECElementEvent;

      // --- Get Chart Option and Validate Params ---
      // Ensure the chart instance is still valid before proceeding
      const chartInstance = chartRef.current?.getEchartsInstance();
      if (!chartInstance) return;

      // Explicitly type the returned options object
      const currentOption = chartInstance.getOption() as EChartsOption;

      // Validate that the params object has the necessary indices and the chart option is valid
      if (
        !params ||
        params.seriesIndex === undefined ||
        params.dataIndex === undefined ||
        !currentOption?.series ||
        !Array.isArray(currentOption.series)
      ) {
        // console.warn("Highlight event triggered but essential params or option/series data is invalid.", params);
        return;
      }

      // --- Access Hovered Data (as implemented previously) ---
      const seriesItem = currentOption.series[params.seriesIndex];
      const hoveredData = Array.isArray(seriesItem?.data) ? seriesItem.data[params.dataIndex] : undefined;

      // Check if we successfully retrieved the data point and if it has the necessary properties
      if (!hoveredData || typeof hoveredData !== 'object' || hoveredData.eventIndex === undefined || !hoveredData.day) {
        // console.warn("Highlight event missing necessary data properties in hoveredData:", hoveredData);
        return; // Exit if the required data properties aren't available
      }

      // --- Highlighting Logic (Remains the same) ---
      const hoveredEventIndex: number = hoveredData.eventIndex;
      const hoveredDay: string = hoveredData.day;

      const seriesToHighlightIndices: number[] = [];
      const seriesToDownplayIndices: number[] = [];

      (currentOption.series as any[]).forEach((series, index) => {
        if (!series.type || ['line', 'bar'].indexOf(series.type) === -1 || !series.data || series.data.length === 0) {
          return;
        }
        const seriesEventIndex = extractEventIndex(series.name) ?? extractEventIndex(series.id);
        if (seriesEventIndex === hoveredEventIndex) {
          const hasMatchingDay = series.data.some((point: any) => point && point.day === hoveredDay);
          if (hasMatchingDay) {
            seriesToHighlightIndices.push(index);
          } else {
            seriesToDownplayIndices.push(index);
          }
        } else {
          seriesToDownplayIndices.push(index);
        }
      });

      // Dispatch actions
      if (seriesToDownplayIndices.length > 0) {
        chartInstance.dispatchAction({
          type: 'downplay',
          seriesIndex: seriesToDownplayIndices,
        });
      }
      if (seriesToHighlightIndices.length > 0) {
        chartInstance.dispatchAction({
          type: 'highlight',
          seriesIndex: seriesToHighlightIndices,
        });
      }
    }; // End of handleHighlight
    // --- Mouseover Handler ---
    // Triggers the initial 'highlight' action when hovering over a data item.
    // This then triggers the 'handleHighlight' listener above.
    const handleMouseOver = (params: ECElementEvent) => {
      // Check if hovering over a valid data point in a line or bar series
      if (
        params.componentType === 'series' &&
        ['line', 'bar'].includes(params.seriesType || '') &&
        params.seriesIndex !== undefined
      ) {
        chartInstance.dispatchAction({
          type: 'highlight',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex, // Pass dataIndex for handleHighlight to use
        });
      }
    };

    // --- Global Out Handler ---
    // Resets all series highlights/downplays when the mouse leaves the chart area.
    const handleGlobalOut = () => {
      const currentOption = chartInstance.getOption();
      if (!currentOption?.series) return;
      // Get indices of all line and bar series to reset them
      const allDataSeriesIndices = (currentOption.series as any[])
        .map((_, index) => index)
        .filter((index) => {
          const series = (currentOption.series as any[])[index];
          return series.type && ['line', 'bar'].includes(series.type);
        });

      if (allDataSeriesIndices.length > 0) {
        chartInstance.dispatchAction({
          type: 'downplay',
          seriesIndex: allDataSeriesIndices,
        });
      }
    };

    // Register event listeners
    chartInstance.on('highlight', handleHighlight);
    chartInstance.on('mouseover', handleMouseOver);
    chartInstance.on('globalout', handleGlobalOut);

    // Initial resize
    chartInstance.resize();

    // Cleanup function to remove listeners when component unmounts or dependencies change
    return () => {
      chartInstance.off('highlight', handleHighlight);
      chartInstance.off('mouseover', handleMouseOver);
      chartInstance.off('globalout', handleGlobalOut);
    };
  }, [chartData]); // Rerun effect if chartData changes (important!)

  // --- Formatters and Goal Calculations ---
  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: units === 'mmol/L' ? 1 : 0,
      maximumFractionDigits: units === 'mmol/L' ? 1 : 0,
    });
  };

  const clinicalLow = units === 'mmol/L' ? 3.9 : 70;
  const clinicalHigh = units === 'mmol/L' ? 10 : 180;
  const adjustedPatientLowGoal =
    patientLowGoal && units === 'mmol/L' ? patientLowGoal / MG_DL_PER_MMOL_L : patientLowGoal;
  const adjustedPatientHighGoal =
    patientHighGoal && units === 'mmol/L' ? patientHighGoal / MG_DL_PER_MMOL_L : patientHighGoal;

  // --- Loading/Empty State ---
  if (cluster.events.length === 0 || chartData.series.length === 0 || processedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No event data available for this cluster.</p>
      </div>
    );
  }

  // --- Y-Axis Scaling Calculations ---
  const allGlucoseValues = chartData.lineSeries.flatMap((s) => s.data.map((d: any) => d.value[1]));
  const minDataValue = Math.min(...allGlucoseValues, adjustedPatientLowGoal ?? Infinity, clinicalLow);
  const maxDataValue = Math.max(...allGlucoseValues, adjustedPatientHighGoal ?? -Infinity, clinicalHigh);
  const yAxisMin = Math.max(0, Math.floor(minDataValue * 0.9));
  const yAxisMax = Math.ceil(maxDataValue * 1.1);

  const maxCarbsValue =
    chartData.hasMealData && chartData.mealSeries.length > 0
      ? Math.max(
          ...chartData.mealSeries.flatMap((s) => s.data.map((d: any) => d.value[1])),
          10, // Ensure minimum carb axis of 10g
        )
      : 0;
  const carbsAxisMax = Math.ceil(maxCarbsValue * 1.2);

  // --- ECharts Option Configuration ---
  const options: EChartsOption = {
    // Title (optional, often handled by parent)
    title: {
      text: undefined, // Set explicitly to null if title is handled outside
      subtext: undefined,
    },

    // Tooltip Configuration
    tooltip: {
      // *** CHANGED: Trigger on item hover, not axis position ***
      trigger: 'item',
      // Removed axisPointer as it's less relevant for 'item' trigger
      // axisPointer: undefined,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderWidth: 1,
      padding: 12,
      textStyle: { fontSize: 13, color: '#333' },
      confine: true, // Keep tooltip within chart bounds

      // Formatter for 'item' trigger
      formatter: (params: any) => {
        // params is now a single object or array of objects at same point
        // Ensure we have valid params data (could be array if items overlap)
        const param = Array.isArray(params) ? params[0] : params;
        if (!param || !param.data || !param.data.value) return ''; // Basic check

        const data = param.data; // The specific data point hovered
        const seriesName = param.seriesName || '';
        const color = param.color || '#ccc';

        // Extract common info
        const normalizedTime = new Date(data.value[0]); // Time is always index 0
        const formattedTime = normalizedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        // const dateInfo = data.originalDateStr
        //   ? `<div style="margin-bottom: 4px;">Date: ${data.originalDateStr}</div>`
        //   : '';

        let content = `<div style="font-weight: bold; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 6px;"><span style="display:inline-block;margin-right:8px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>${seriesName}</div>`;
        content += `<div style="margin-bottom: 4px;">${data.originalDateStr} ${formattedTime}</div>`;
        // content += dateInfo;

        // Add specific info based on series type
        if (data.seriesType === 'glucose') {
          const glucoseValueFormatted = `${formatValue(data.glucoseInUserUnits)} ${units}`;
          content += `<div style="margin-top: 8px;">
                            <span style="margin-left: 5px; font-weight: bold;">${glucoseValueFormatted}</span>
                         </div>`;
          // if (data.eventType) {
          //   content += `<div style="margin-left: 18px; font-size: 11px; color: #555;">Type: ${getEventTypeName(data.eventType)}</div>`;
          // }
          // if (data.duration) {
          //   content += `<div style="margin-left: 18px; font-size: 11px; color: #555;">Event Duration: ${data.duration} min</div>`;
          // }
        } else if (data.seriesType === 'carbs') {
          const carbsValueFormatted = `${data.originalCarbs} g`;
          content += `<div style="margin-top: 8px;">

                            <span style="font-weight: 500;">Carbs:</span>
                            <span style="margin-left: 5px; font-weight: bold;">${carbsValueFormatted}</span>
                         </div>`;
          // if (data.notes) {
          //   content += `<div style="margin-left: 18px; font-style: italic; font-size: 11px; color: #555;">"${data.notes}"</div>`;
          // }
          // if (data.mealEventType) {
          //   content += `<div style="margin-left: 18px; font-size: 11px; color: #555;">Type: ${data.mealEventType}</div>`;
          // }
        }
        // Potential TODO: Could try to find the 'linked' data point (e.g., find carb bar for hovered glucose point on same day/eventIndex)
        // This would require iterating through other series data here, which might be slow. Keeping it simple for now.

        return content;
      },
      extraCssText: 'box-shadow: 0 3px 14px rgba(0,0,0,0.15); border-radius: 6px;',
    },

    // Grid Configuration (Dynamic based on meal data presence)
    grid: chartData.hasMealData
      ? [
          { left: 70, right: 30, top: 20, bottom: '45%', containLabel: true }, // Top: Glucose
          { left: 70, right: 30, top: '60%', bottom: 100, containLabel: true }, // Bottom: Meals
        ]
      : { left: 70, right: 30, top: 20, bottom: 100, containLabel: true }, // Single grid if no meals

    // X-Axis Configuration (Dynamic)
    xAxis: chartData.hasMealData
      ? [
          {
            // Top X-Axis (Glucose)
            gridIndex: 0,
            type: 'time',
            min: chartData.windowStartTime.toISOString(),
            max: chartData.windowEndTime.toISOString(),
            axisLine: { show: true, lineStyle: { color: '#ccc' } },
            axisTick: { show: true, lineStyle: { color: '#ccc' } },
            axisLabel: { show: false }, // Hide labels on top axis to reduce clutter
            axisPointer: { show: false }, // Hide pointer label on top axis too
          },
          {
            // Bottom X-Axis (Meals / Shared Time)
            gridIndex: 1,
            type: 'time',
            min: chartData.windowStartTime.toISOString(),
            max: chartData.windowEndTime.toISOString(),
            axisLine: { show: true, lineStyle: { color: '#ccc' } },
            axisTick: { show: true, lineStyle: { color: '#ccc' } },
            axisLabel: {
              // Show labels only on bottom axis
              formatter: (value: number) => formatTime(value),
              color: '#333',
            },
            // Link axis pointers if needed (though trigger:item makes this less critical)
            // axisPointer: { link: [{ xAxisIndex: 0 }] }
          },
        ]
      : {
          // Single X-Axis
          type: 'time',
          min: chartData.windowStartTime.toISOString(),
          max: chartData.windowEndTime.toISOString(),
          axisLine: { show: true, lineStyle: { color: '#ccc' } },
          axisTick: { show: true, lineStyle: { color: '#ccc' } },
          axisLabel: {
            formatter: (value: number) => formatTime(value),
            color: '#333',
          },
        },

    // Y-Axis Configuration (Dynamic)
    yAxis: chartData.hasMealData
      ? [
          {
            // Left Y-Axis (Glucose)
            gridIndex: 0,
            type: 'value',
            name: `Glucose (${units})`,
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
            min: yAxisMin,
            max: yAxisMax,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.4 } },
          },
          {
            // Left Y-Axis (Carbs)
            gridIndex: 1,
            type: 'value',
            name: 'Carbs (g)',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
            min: 0,
            max: carbsAxisMax > 0 ? carbsAxisMax : 100, // Ensure non-zero max
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.4 } },
          },
        ]
      : {
          // Single Y-Axis (Glucose)
          type: 'value',
          name: `Glucose (${units})`,
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
          min: yAxisMin,
          max: yAxisMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.4 } },
        },

    // Series Data (Generated in useMemo)
    series: [
      // Spread the generated line and bar series
      ...chartData.series,

      // --- Add Mark Lines ---
      // These are separate, non-interactive series used only for drawing lines
      {
        name: 'Clinical Low',
        type: 'line',
        silent: true, // Non-interactive
        data: [], // No data points needed
        markLine: {
          silent: true,
          precision: 1, // Non-interactive, precision for label display
          symbol: 'none', // No arrows at ends
          lineStyle: { color: '#f5222d', type: 'dashed', width: 1.5 },
          label: { show: true, position: 'end', formatter: 'Low', fontSize: 11, color: '#f5222d', distance: 5 },
          data: [{ yAxis: clinicalLow }],
        },
        // Ensure it's on the correct axis if using split view
        ...(chartData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}),
      },
      {
        name: 'Clinical High',
        type: 'line',
        silent: true,
        data: [],
        markLine: {
          silent: true,
          precision: 1,
          symbol: 'none',
          lineStyle: { color: '#f5222d', type: 'dashed', width: 1.5 },
          label: { show: true, position: 'end', formatter: 'High', fontSize: 11, color: '#f5222d', distance: 5 },
          data: [{ yAxis: clinicalHigh }],
        },
        ...(chartData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}),
      },
      // Conditional Patient Goal Lines
      ...(adjustedPatientLowGoal !== undefined && adjustedPatientLowGoal !== null
        ? [
            {
              name: 'Patient Low Goal',
              type: 'line',
              silent: true,
              data: [],
              markLine: {
                silent: true,
                precision: 1,
                symbol: 'none',
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
                label: {
                  show: true,
                  position: 'end',
                  formatter: 'Target Low',
                  fontSize: 11,
                  color: '#52c41a',
                  distance: 5,
                },
                data: [{ yAxis: adjustedPatientLowGoal }],
              },
              ...(chartData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}),
            },
          ]
        : []),
      ...(adjustedPatientHighGoal !== undefined && adjustedPatientHighGoal !== null
        ? [
            {
              name: 'Patient High Goal',
              type: 'line',
              silent: true,
              data: [],
              markLine: {
                silent: true,
                precision: 1,
                symbol: 'none',
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
                label: {
                  show: true,
                  position: 'end',
                  formatter: 'Target High',
                  fontSize: 11,
                  color: '#52c41a',
                  distance: 5,
                },
                data: [{ yAxis: adjustedPatientHighGoal }],
              },
              ...(chartData.hasMealData ? { xAxisIndex: 0, yAxisIndex: 0 } : {}),
            },
          ]
        : []),
    ],

    // Legend Configuration
    legend: {
      type: 'scroll', // Enable scrolling if many legend items
      orient: 'horizontal',
      bottom: 10, // Position at the bottom
      padding: [20, 20], // Padding around legend
      itemGap: 15,
      textStyle: { fontSize: 12, color: '#333' },
      // Generate legend data from the actual series names
      data: chartData.series.map((s) => s.name!),
      // Set initial selected state (all true) - ECharts handles this by default if 'data' is provided
      // selected: chartData.series.reduce((acc, s) => ({ ...acc, [s.name!]: true }), {}),
      selectedMode: 'multiple', // Allow toggling multiple series
    },

    // State Styles (Emphasis / Blur) - These apply globally unless overridden in series
    emphasis: {
      // When a series is highlighted (by dispatchAction or legend hover)
      focus: 'series', // This is key to enable blurring other series
      scale: false, // Don't scale points/bars on hover
      // Styles defined within series take precedence, but set defaults here if needed
      lineStyle: { width: 3 }, // Slightly thicker line
      itemStyle: { borderWidth: 1, borderColor: '#555' }, // e.g., subtle border on points/bars
    },
    blur: {
      // When a series is downplayed (because another is highlighted)
      lineStyle: { opacity: 0.2, color: '#ccc' }, // Make lines faint gray
      itemStyle: { opacity: 0.2, color: '#ccc' }, // Make points/bars faint gray
    },

    // Animation Settings
    animation: true,
    animationDurationUpdate: 200, // Animation duration for updates/highlighting
    animationEasingUpdate: 'cubicOut', // Smooth easing for transitions
  };

  return (
    <div className="w-full h-[450px] p-1 border rounded-lg shadow-sm bg-card text-card-foreground relative">
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // Use SVG renderer
        // Consider adding notMerge={false} if you want subsequent renders to merge options
        // notMerge={false}
      />
    </div>
  );
}
