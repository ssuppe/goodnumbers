import React, { useMemo, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
} from "echarts/components";
import { CHART_THEME } from "../../../lib/chartTheme";
import {
  getClinicalThresholds,
  convertGlucose,
  type GlucoseUnit,
  type Treatment,
} from "../../../lib/agpUtils";
import type { GlycemicCluster } from "@goodnumbers/types";
import { format } from "date-fns";
import {
  getBoundaryHour,
  normalizeTime,
  formatAxisLabel,
  calculateCommonDomain,
} from "./chartUtils";

// Register components
echarts.use([
  CanvasRenderer,
  SVGRenderer,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
]);

interface ClusterEventsChartProps {
  cluster: GlycemicCluster;
  units: GlucoseUnit;
  treatments?: Treatment[];
  evidenceWindowMins?: number;
}

// Buffer in minutes to search for treatments around an event
// Increased to 180 (3 hours) to catch treatments that occur well before the glucose response
const TREATMENT_BUFFER_MINUTES = 180;

// Minimal interface for ECharts event params to satisfy linter
interface EChartsEventParams {
  seriesName: string;
  // Add other properties if needed in future
}

// --- Visual Style Constants (from PoC) ---
const eventColors = [
  "#1976d2", // Brand Blue (Anchor)
  "#264653", // Charcoal Green
  "#e76f51", // Burnt Sienna (Clay)
  "#2a9d8f", // Jungle Teal
  "#6d597a", // Dusty Purple
  "#bc6c25", // Bronze/Earth
  "#457b9d", // Steel Blue
  "#5d4037", // Coffee Brown
];
const lineStyleTypes = ["solid", "dashed", "dotted"];

function getEventVisuals(index: number) {
  return {
    color: eventColors[index % eventColors.length],
    lineType:
      lineStyleTypes[
        Math.floor(index / eventColors.length) % lineStyleTypes.length
      ],
  };
}

export function ClusterEventsChart({
  cluster,
  units,
  treatments = [],
  evidenceWindowMins = 0,
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the best start hour for this specific cluster to handle midnight wraparound
  // We MUST include relevant treatments in this calculation so they don't get split from their events.
  const boundaryHour = useMemo(() => {
    const relevantTreatmentTimestamps: number[] = [];

    // Find all treatments that are "relevant" (within buffer of any event)
    if (treatments.length > 0) {
      cluster.events.forEach((event) => {
        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();
        const searchStart = eventStart - TREATMENT_BUFFER_MINUTES * 60000;
        const searchEnd = eventEnd + TREATMENT_BUFFER_MINUTES * 60000;

        treatments.forEach((t) => {
          const tTime = new Date(t.date).getTime();
          if (
            ((t.carbs && t.carbs > 0) || (t.insulin && t.insulin > 0)) &&
            tTime >= searchStart &&
            tTime <= searchEnd
          ) {
            relevantTreatmentTimestamps.push(tTime);
          }
        });
      });
    }
    return getBoundaryHour(cluster, relevantTreatmentTimestamps);
  }, [cluster, treatments]);

  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    const chartInstance = chartRef.current.getEchartsInstance();
    const resizeObserver = new ResizeObserver(() => chartInstance.resize());
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- Manual Interaction Handlers ---
  // These ensure that hovering a line highlights the corresponding bar, and vice versa.
  const onEvents = useMemo(
    () => ({
      mouseover: (params: EChartsEventParams) => {
        const chartInstance = chartRef.current?.getEchartsInstance();
        if (!chartInstance) return;

        // Dispatch highlight for ALL series with this name (Line + Bar)
        // This overrides the default 'focus: series' behavior which would blur the other one.
        chartInstance.dispatchAction({
          type: "highlight",
          seriesName: params.seriesName,
        });
      },
      mouseout: (params: EChartsEventParams) => {
        const chartInstance = chartRef.current?.getEchartsInstance();
        if (!chartInstance) return;

        chartInstance.dispatchAction({
          type: "downplay",
          seriesName: params.seriesName,
        });
      },
    }),
    [],
  );

  const options = useMemo(() => {
    if (!cluster.events.length) return null;
    const isMmol = (units as string).toUpperCase() === "MMOL";
    const normalizedUnits = (isMmol ? "MMOL" : "MGDL") as GlucoseUnit;
    const thresholds = getClinicalThresholds(normalizedUnits);

    const sortedEvents = [...cluster.events]
      .filter((e) => e.readings && e.readings.length >= 2) // Defensive: ECharts crashes on 1-point gradients
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    if (sortedEvents.length === 0) return null;

    // Calculate global normalized bounds for the entire cluster
    let globalMinNormalized = Infinity;
    let globalMaxNormalized = -Infinity;

    sortedEvents.forEach((event) => {
      const nStart = normalizeTime(event.startTime, boundaryHour);
      const nEnd = normalizeTime(event.endTime, boundaryHour);
      if (isNaN(nStart) || isNaN(nEnd)) return; // Skip invalid dates

      if (nStart < globalMinNormalized) globalMinNormalized = nStart;
      if (nEnd > globalMaxNormalized) globalMaxNormalized = nEnd;
    });

    if (globalMinNormalized === Infinity) return null;

    const globalSearchStart =
      globalMinNormalized - TREATMENT_BUFFER_MINUTES * 60000;
    const globalSearchEnd =
      globalMaxNormalized + TREATMENT_BUFFER_MINUTES * 60000;

    const hasCarbData = treatments.some((t) => t.carbs && t.carbs > 0);
    const hasInsulinData = treatments.some((t) => t.insulin && t.insulin > 0);
    const hasAnyTreatments = hasCarbData || hasInsulinData;

    // Create a map of unique days to assign consistent colors
    const uniqueDays = Array.from(
      new Set(
        sortedEvents.map((e) => format(new Date(e.startTime), "EEE, MMM d")),
      ),
    );

    // Create visualMaps for each line series to dim the actual line segments
    const visualMaps = sortedEvents.map((event, index) => {
      const startDate = new Date(event.startTime);
      const dayIndex = uniqueDays.indexOf(format(startDate, "EEE, MMM d"));
      const visuals = getEventVisuals(dayIndex);

      const normalizedStartTime = normalizeTime(event.startTime, boundaryHour);
      const durationMillis =
        new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
      const normalizedEndTime = normalizedStartTime + durationMillis;

      // Defensive: Fallback to simple color if math fails
      if (isNaN(normalizedStartTime) || isNaN(normalizedEndTime)) {
        return {
          show: false,
          seriesIndex: index,
          color: visuals.color,
        };
      }

      return {
        show: false,
        dimension: 0, // Map along the X-axis (normalized time)
        seriesIndex: index,
        pieces: [
          {
            gt: -Infinity,
            lt: normalizedStartTime,
            color: `${visuals.color}33`, // 20% opacity for context
          },
          {
            gte: normalizedStartTime,
            lte: normalizedEndTime,
            color: visuals.color, // 100% opacity for event
          },
          {
            gt: normalizedEndTime,
            color: `${visuals.color}33`, // 20% opacity for context
          },
        ],
      };
    });

    const lineSeries = sortedEvents.map((event) => {
      const startDate = new Date(event.startTime);
      const dayIndex = uniqueDays.indexOf(format(startDate, "EEE, MMM d"));
      const visuals = getEventVisuals(dayIndex);

      // ANCHOR: Calculate a single base normalized time for the event start
      const normalizedStartTime = normalizeTime(event.startTime, boundaryHour);
      const originalStartTimeMillis = startDate.getTime();

      // LEGEND: Force the series name to match the normalized UTC time seen on the axis.
      // This prevents the "7:30 AM vs 12:45 AM" discrepancy caused by browser local time.
      const seriesName = `${format(startDate, "EEE, MMM d")} @ ${new Date(normalizedStartTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`;

      return {
        name: seriesName,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: true,
        symbol: "circle",
        symbolSize: 3, // Smaller markers as requested
        smooth: true,
        lineStyle: {
          width: 4,
          // Removed static opacity to let visualMap handle piecewise opacity
        },
        itemStyle: {
          borderWidth: 0,
          // Color is now handled by visualMap as well
        },
        emphasis: {
          focus: "series",
          lineStyle: {
            width: 6,
          },
        },
        blur: {
          lineStyle: { opacity: 0.15 },
          itemStyle: { opacity: 0.15 },
        },
        markLine: {
          silent: true,
          symbol: "none",
          data: [
            {
              xAxis: normalizedStartTime,
              lineStyle: {
                color: visuals.color,
                type: "dashed",
                width: 1,
                opacity: 0.6,
              },
              label: { show: false },
            },
          ],
        },
        data: event.readings
          .map((r) => {
            const originalReadingTime = new Date(r.timestamp).getTime();
            const offset = originalReadingTime - originalStartTimeMillis;
            const glucoseValue = convertGlucose(r.value, normalizedUnits);

            if (isNaN(originalReadingTime) || isNaN(glucoseValue)) return null;

            return {
              value: [normalizedStartTime + offset, glucoseValue],
              originalDate: r.timestamp,
            };
          })
          .filter((d): d is { value: [number, number]; originalDate: string } =>
            Boolean(d),
          ),
      };
    });

    // Helper to build bar series for treatments (Carbs or Insulin)
    const buildBarSeries = (
      type: "carbs" | "insulin",
      xAxisIdx: number,
      yAxisIdx: number,
    ) => {
      return sortedEvents
        .map((event) => {
          const seriesName = format(new Date(event.startTime), "EEE, MMM d");
          const dayIndex = uniqueDays.indexOf(seriesName);
          const visuals = getEventVisuals(dayIndex);

          const realStart = new Date(event.startTime).getTime();
          const timeShift =
            realStart - normalizeTime(event.startTime, boundaryHour);
          const localSearchStart = globalSearchStart + timeShift;
          const localSearchEnd = globalSearchEnd + timeShift;

          const eventTreatments = treatments.filter((t) => {
            const val = type === "carbs" ? t.carbs : t.insulin;
            if (!val || val <= 0) return false;
            const tTime = new Date(t.date).getTime();
            return tTime >= localSearchStart && tTime <= localSearchEnd;
          });

          if (eventTreatments.length === 0) return null;

          return {
            name: seriesName,
            type: "bar",
            xAxisIndex: xAxisIdx,
            yAxisIndex: yAxisIdx,
            barWidth: 8,
            itemStyle: { color: visuals.color, opacity: 1 },
            emphasis: { focus: "series" },
            blur: { itemStyle: { opacity: 0.1 } },
            data: eventTreatments.map((t) => ({
              value: [
                normalizeTime(t.date, boundaryHour),
                type === "carbs" ? t.carbs : t.insulin,
              ],
              originalDate: t.date,
              originalValue: type === "carbs" ? t.carbs : t.insulin,
              treatmentType: type,
            })),
          };
        })
        .filter(Boolean);
    };

    const carbSeries = hasCarbData
      ? buildBarSeries(
          "carbs",
          hasAnyTreatments ? 1 : 0,
          hasAnyTreatments ? 1 : 0,
        )
      : [];

    // Determine the next available grid indices for insulin
    let insulinGridIdx = 0;
    if (hasCarbData && hasInsulinData) {
      insulinGridIdx = 2;
    } else if (hasCarbData || hasInsulinData) {
      insulinGridIdx = 1;
    }

    const insulinSeries = hasInsulinData
      ? buildBarSeries("insulin", insulinGridIdx, insulinGridIdx)
      : [];

    // --- Dynamic Grid Layout ---
    const grid = [];
    if (!hasAnyTreatments) {
      grid.push({
        show: true,
        backgroundColor: "#f8f9fa",
        borderWidth: 0,
        left: 60,
        right: 20,
        bottom: "15%",
        top: "10%",
        containLabel: false,
      });
    } else {
      // We have one or two subplots
      const subplotsCount = (hasCarbData ? 1 : 0) + (hasInsulinData ? 1 : 0);

      // Main chart (Glucose)
      grid.push({
        show: true,
        backgroundColor: "#f8f9fa",
        borderWidth: 0,
        left: 60,
        right: 20,
        top: "8%",
        height: subplotsCount === 2 ? "40%" : "55%", // Make it smaller if 3 charts total
        containLabel: false,
      });

      // Carbs (Middle)
      if (hasCarbData) {
        grid.push({
          left: 60,
          right: 20,
          top: subplotsCount === 2 ? "55%" : "70%",
          height: "15%",
          containLabel: false,
        });
      }

      // Insulin (Bottom)
      if (hasInsulinData) {
        grid.push({
          left: 60,
          right: 20,
          top: subplotsCount === 2 ? "75%" : "70%",
          height: "15%",
          containLabel: false,
        });
      }
    }

    const allSeries = [...lineSeries, ...carbSeries, ...insulinSeries];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    const domain = calculateCommonDomain(allSeries as any);

    // Apply Smart Zoom: Adjust domain.min if evidenceWindowMins is set
    const finalMin = domain
      ? evidenceWindowMins > 0
        ? Math.min(domain.min, globalMinNormalized - evidenceWindowMins * 60000)
        : domain.min
      : undefined;

    const xAxisCommon = {
      min: finalMin,
      max: domain ? domain.max : undefined,
    };

    // --- Dynamic X-Axes ---
    const xAxis = [];
    if (!hasAnyTreatments) {
      xAxis.push({
        type: "time",
        axisLabel: { formatter: formatAxisLabel },
        interval: 3600 * 1000,
        ...xAxisCommon,
      });
    } else {
      const subplotsCount = (hasCarbData ? 1 : 0) + (hasInsulinData ? 1 : 0);

      // Axis 0 (Glucose)
      xAxis.push({
        type: "time",
        gridIndex: 0,
        axisLabel: { show: false },
        axisTick: { show: false },
        ...xAxisCommon,
      });

      // Axis 1 (First Subplot)
      xAxis.push({
        type: "time",
        gridIndex: 1,
        // Only show labels if it's the bottom-most axis
        axisLabel: { show: subplotsCount === 1, formatter: formatAxisLabel },
        axisTick: { show: subplotsCount === 1 },
        interval: 1800 * 1000,
        ...xAxisCommon,
      });

      // Axis 2 (Second Subplot, if exists)
      if (subplotsCount === 2) {
        xAxis.push({
          type: "time",
          gridIndex: 2,
          axisLabel: { formatter: formatAxisLabel },
          interval: 1800 * 1000,
          ...xAxisCommon,
        });
      }
    }

    // --- Dynamic Y-Axes ---
    const yAxis = [];
    yAxis.push({
      type: "value",
      gridIndex: 0,
      name: `Glucose (${isMmol ? "mmol/L" : "mg/dL"})`,
      nameLocation: "middle",
      nameRotate: 90,
      nameGap: 50,
      min: (value: { min: number }) => Math.floor(value.min * 0.9),
      max: (value: { max: number }) => Math.ceil(value.max * 1.1),
      splitLine: { lineStyle: { type: "dashed", color: "#eee" } },
    });

    if (hasCarbData) {
      yAxis.push({
        type: "value",
        gridIndex: grid.length - (hasInsulinData ? 2 : 1), // Index based on grid count
        name: "Carbs (g)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 50,
        splitLine: { show: false },
      });
    }

    if (hasInsulinData) {
      yAxis.push({
        type: "value",
        gridIndex: grid.length - 1, // Always last
        name: "Insulin (u)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: 50,
        splitLine: { show: false },
      });
    }

    return {
      tooltip: {
        trigger: "item",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const p = params;
          const dateSource = (p.data.originalDate || p.data.value[0]) as
            | string
            | number;
          const time = new Date(dateSource);
          const timeStr = time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });

          let content = `<div><span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${p.color};"></span>${p.seriesName}</div>`;
          content += `<div>${timeStr}</div>`;

          if (p.seriesType === "line") {
            const unitLabel = isMmol ? "mmol/L" : "mg/dL";
            content += `<div>Glucose: <strong>${p.data.value[1]}</strong> ${unitLabel}</div>`;
          } else if (p.seriesType === "bar") {
            const label =
              p.data.treatmentType === "carbs" ? "Carbs" : "Insulin";
            const unit = p.data.treatmentType === "carbs" ? "g" : "u";
            content += `<div>${label}: <strong>${p.data.originalValue}${unit}</strong></div>`;
          }
          return content;
        },
      },
      axisPointer: {
        link: { xAxisIndex: "all" },
        label: { backgroundColor: "#777" },
      },
      visualMap: visualMaps,
      legend: { show: true, bottom: 0, type: "scroll" },
      grid: grid,
      xAxis: xAxis,
      yAxis: yAxis,
      series: [
        ...lineSeries,
        {
          type: "line",
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                yAxis: thresholds.high,
                lineStyle: { color: CHART_THEME.clinicalHigh },
              },
              {
                yAxis: thresholds.low,
                lineStyle: { color: CHART_THEME.clinicalLow },
              },
            ],
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        ...carbSeries,
        ...insulinSeries,
      ],
    };
  }, [cluster, units, treatments, boundaryHour, evidenceWindowMins]);

  return (
    <div ref={containerRef} className="w-full h-96">
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge={true}
        onEvents={onEvents}
      />
    </div>
  );
}
