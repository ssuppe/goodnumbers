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
import { getBoundaryHour, normalizeTime } from "./chartUtils";

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

// Minimal interface for ECharts event params to satisfy linter
interface EChartsEventParams {
  seriesName: string;
  // Add other properties if needed in future
}

// --- Visual Style Constants (from PoC) ---
const eventColors = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
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

  // Calculate the best start hour for this specific cluster to handle midnight wraparound
  const boundaryHour = useMemo(() => getBoundaryHour(cluster), [cluster]);

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

    const sortedEvents = [...cluster.events].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

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
          width: 2,
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
            width: 4,
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
            const eventStart = new Date(event.startTime);
            const eventEnd = new Date(event.endTime);
            const bufferMinutes = 60;
            const searchStart = new Date(
              eventStart.getTime() - bufferMinutes * 60000,
            );
            const searchEnd = new Date(
              eventEnd.getTime() + bufferMinutes * 60000,
            );

            const eventTreatments = treatments.filter((t) => {
              const tDate = new Date(t.date);
              return (
                t.carbs &&
                t.carbs > 0 &&
                tDate >= searchStart &&
                tDate <= searchEnd
              );
            });

            if (eventTreatments.length === 0) return null;

            const startDate = new Date(event.startTime);
            const seriesName = format(startDate, "EEE, MMM d");

            return {
              name: seriesName,
              type: "bar",
              xAxisIndex: 1,
              yAxisIndex: 1,
              itemStyle: {
                color: visuals.color,
                opacity: 0.6,
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
            left: "5%",
            right: "5%",
            top: "10%",
            height: "55%",
            containLabel: true,
          },
          {
            left: "5%",
            right: "5%",
            top: "70%",
            height: "15%",
            containLabel: true,
          },
        ]
      : [
          {
            left: "5%",
            right: "5%",
            bottom: "15%",
            top: "10%",
            containLabel: true,
          },
        ];

    const xAxis = hasCarbData
      ? [
          {
            type: "time",
            gridIndex: 0,
            axisLabel: { show: false },
            axisTick: { show: false },
          },
          {
            type: "time",
            gridIndex: 1,
            axisLabel: { formatter: "{HH}:{mm}" },
          },
        ]
      : [{ type: "time", axisLabel: { formatter: "{HH}:{mm}" } }];

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
