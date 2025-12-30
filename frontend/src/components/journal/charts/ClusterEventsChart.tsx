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
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  console.log("Treatments in ClusterEventsChart:", treatments);
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
            t.carbs &&
            t.carbs > 0 &&
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
    []
  );

  const options = useMemo(() => {
    if (!cluster.events.length) return null;
    const isMmol = (units as string).toUpperCase() === "MMOL";
    const normalizedUnits = (isMmol ? "MMOL" : "MGDL") as GlucoseUnit;
    const thresholds = getClinicalThresholds(normalizedUnits);

    const sortedEvents = [...cluster.events].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Calculate global normalized bounds for the entire cluster
    // This ensures that if one day starts early (e.g. 1pm) and another late (e.g. 3pm),
    // we search for carbs starting from the earliest time (1pm - buffer) for ALL days.
    let globalMinNormalized = Infinity;
    let globalMaxNormalized = -Infinity;

    sortedEvents.forEach((event) => {
      const nStart = normalizeTime(event.startTime, boundaryHour);
      const nEnd = normalizeTime(event.endTime, boundaryHour);
      if (nStart < globalMinNormalized) globalMinNormalized = nStart;
      if (nEnd > globalMaxNormalized) globalMaxNormalized = nEnd;
    });

    // Apply buffer to the global normalized window
    const globalSearchStart =
      globalMinNormalized - TREATMENT_BUFFER_MINUTES * 60000;
    const globalSearchEnd =
      globalMaxNormalized + TREATMENT_BUFFER_MINUTES * 60000;

    const hasCarbData = treatments.some((t) => t.carbs && t.carbs > 0);

    const lineSeries = sortedEvents.map((event, index) => {
      const visuals = getEventVisuals(index);
      const startDate = new Date(event.startTime);
      const seriesName = format(startDate, "EEE, MMM d");

      return {
        name: seriesName,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: true,
        smooth: true,
        lineStyle: {
          width: 4,
          opacity: 0.8,
          color: visuals.color,
          type: visuals.lineType,
        },
        itemStyle: {
          color: visuals.color,
        },
        // We keep focus: 'series' to blur *other* days.
        // Our manual event handler will ensure the sibling bar chart stays lit.
        emphasis: {
          focus: "series",
          lineStyle: {
            width: 6,
          },
        },
        blur: {
          lineStyle: { opacity: 0.1 },
          itemStyle: { opacity: 0.1 },
        },
        data: event.readings.map((r) => ({
          value: [
            normalizeTime(r.timestamp, boundaryHour),
            convertGlucose(r.value, normalizedUnits),
          ],
          originalDate: r.timestamp,
        })),
      };
    });

    const barSeries = hasCarbData
      ? sortedEvents
          .map((event, index) => {
            const visuals = getEventVisuals(index);

            // Calculate the time shift for this specific day
            // Shift = RealTime - NormalizedTime
            // This allows us to project the Global Normalized Window onto this specific specific calendar day
            const realStart = new Date(event.startTime).getTime();
            const normalizedStart = normalizeTime(
              event.startTime,
              boundaryHour
            );
            const timeShift = realStart - normalizedStart;

            const localSearchStart = globalSearchStart + timeShift;
            const localSearchEnd = globalSearchEnd + timeShift;

            const eventTreatments = treatments.filter((t) => {
              if (!t.carbs || t.carbs <= 0) return false;
              const tTime = new Date(t.date).getTime();
              return tTime >= localSearchStart && tTime <= localSearchEnd;
            });

            if (eventTreatments.length === 0) return null;

            const startDate = new Date(event.startTime);
            const seriesName = format(startDate, "EEE, MMM d");

            return {
              name: seriesName,
              type: "bar",
              xAxisIndex: 1,
              yAxisIndex: 1,
              barWidth: 10,
              itemStyle: {
                color: visuals.color,
                opacity: 1,
              },
              emphasis: {
                focus: "series",
              },
              blur: {
                itemStyle: { opacity: 0.1 },
              },
              data: eventTreatments.map((t) => ({
                value: [normalizeTime(t.date, boundaryHour), t.carbs],
                originalDate: t.date,
                originalCarbs: t.carbs,
              })),
            };
          })
          .filter(Boolean)
      : [];

    const grid = hasCarbData
      ? [
          {
            show: true,
            backgroundColor: "#f8f9fa",
            borderWidth: 0,
            left: 60,
            right: 20,
            top: "10%",
            height: "55%",
            containLabel: false,
          },
          {
            left: 60,
            right: 20,
            top: "70%",
            height: "15%",
            containLabel: false,
          },
        ]
      : [
          {
            show: true,
            backgroundColor: "#f8f9fa",
            borderWidth: 0,
            left: 60,
            right: 20,
            bottom: "15%",
            top: "10%",
            containLabel: false,
          },
        ];

    // Calculate common domain for synchronized axes
    const allSeries = [...lineSeries, ...barSeries];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain = calculateCommonDomain(allSeries as any);

    const xAxisCommon = {
      min: domain ? domain.min : undefined,
      max: domain ? domain.max : undefined,
    };

    const xAxis = hasCarbData
      ? [
          {
            type: "time",
            gridIndex: 0,
            axisLabel: { show: false },
            axisTick: { show: false },
            ...xAxisCommon,
          },
          {
            type: "time",
            gridIndex: 1,
            axisLabel: { formatter: formatAxisLabel },
            interval: 1800 * 1000,
            ...xAxisCommon,
          },
        ]
      : [
          {
            type: "time",
            axisLabel: { formatter: formatAxisLabel },
            interval: 3600 * 1000,
            ...xAxisCommon,
          },
        ];

    const yAxis = hasCarbData
      ? [
          {
            type: "value",
            gridIndex: 0,
            name: `Glucose (${isMmol ? "mmol/L" : "mg/dL"})`,
            nameLocation: "middle",
            nameRotate: 90,
            nameGap: 50,
            min: (value: { min: number }) => Math.floor(value.min * 0.9),
            max: (value: { max: number }) => Math.ceil(value.max * 1.1),
            splitLine: { lineStyle: { type: "dashed", color: "#eee" } },
          },
          {
            type: "value",
            gridIndex: 1,
            name: "Carbs (g)",
            nameLocation: "middle", // Center the label
            nameRotate: 90, // Rotate 90 degrees counter-clockwise
            nameGap: 50, // Match the spacing of the glucose axis
            splitLine: { show: false },
          },
        ]
      : [
          {
            type: "value",
            gridIndex: 0,
            name: `Glucose (${isMmol ? "mmol/L" : "mg/dL"})`,
            nameLocation: "middle",
            nameRotate: 90,
            nameGap: 50,
            scale: true,
            min: (value: { min: number }) => Math.floor(value.min * 0.9),
            max: (value: { max: number }) => Math.ceil(value.max * 1.1),
            splitLine: { lineStyle: { type: "dashed", color: "#eee" } },
          },
        ];

    return {
      tooltip: {
        trigger: "item",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const p = params;
          // Use originalDate for the truth.
          // params.value[0] is the NORMALIZED time (year 2000).
          const dateSource = (p.data.originalDate || p.data.value[0]) as
            | string
            | number;
          const time = new Date(dateSource);

          const timeStr = time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });
          const color = p.color;
          const seriesName = p.seriesName;

          let content = `<div><span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${color};"></span>${seriesName}</div>`;
          content += `<div>${timeStr}</div>`;

          if (p.seriesType === "line") {
            const unitLabel = isMmol ? "mmol/L" : "mg/dL";
            content += `<div>Glucose: <strong>${p.data.value[1]}</strong> ${unitLabel}</div>`;
          } else if (p.seriesType === "bar") {
            content += `<div>Carbs: <strong>${p.data.originalCarbs}g</strong></div>`;
          }
          return content;
        },
      },
      axisPointer: {
        link: { xAxisIndex: "all" },
        label: { backgroundColor: "#777" },
      },
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
        ...barSeries,
      ],
    };
  }, [cluster, units, treatments, boundaryHour]);

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
