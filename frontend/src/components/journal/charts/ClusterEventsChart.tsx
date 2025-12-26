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

// Function to get visual properties based on event index, ensuring color consistency
function getEventVisuals(index: number) {
  return {
    color: eventColors[index % eventColors.length],
    lineType:
      lineStyleTypes[
        Math.floor(index / eventColors.length) % lineStyleTypes.length
      ],
  };
}

// Helper: Normalize any date string to Jan 1, 2000, preserving time
// We use UTC methods to avoid timezone issues during normalization if the input is UTC
const normalizeTime = (isoString: string) => {
  const d = new Date(isoString);
  // Set to a fixed date (Jan 1, 2000)
  d.setUTCFullYear(2000);
  d.setUTCMonth(0);
  d.setUTCDate(1);
  return d.getTime();
};

export function ClusterEventsChart({
  cluster,
  units,
  treatments = [],
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize observer logic
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    const chartInstance = chartRef.current.getEchartsInstance();
    const resizeObserver = new ResizeObserver(() => chartInstance.resize());
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const options = useMemo(() => {
    if (!cluster.events.length) return null;
    // Normalize units to handle case insensitivity (e.g. "mmol" vs "MMOL")
    const isMmol = (units as string).toUpperCase() === "MMOL";
    const normalizedUnits = (isMmol ? "MMOL" : "MGDL") as GlucoseUnit;

    console.log("[ClusterEventsChart] Debug:", {
      rawUnits: units,
      isMmol,
      normalizedUnits,
      clusterId: cluster.id || "unknown",
      eventsCount: cluster.events.length,
    });

    const thresholds = getClinicalThresholds(normalizedUnits);

    // Sort events by startTime to ensure legend is chronological
    const sortedEvents = [...cluster.events].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    // Check if we have any relevant treatments to display
    const hasCarbData = treatments.some((t) => t.carbs && t.carbs > 0);

    // Create a series for each event in the cluster
    const lineSeries = sortedEvents.map((event, index) => {
      const visuals = getEventVisuals(index);

      // Format start date for series name (e.g., "Sun, Jan 1")
      const startDate = new Date(event.startTime);
      const seriesName = format(startDate, "EEE, MMM d");

      return {
        name: seriesName,
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: true, // Enabled to help identify data points
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
        // Spotlight Effect Configuration
        emphasis: {
          focus: "series", // Blurs other series when this one is hovered
          lineStyle: {
            width: 4, // Make line thicker on hover
          },
        },
        blur: {
          lineStyle: {
            opacity: 0.1, // Fade out other lines significantly
          },
          itemStyle: {
            opacity: 0.1,
          },
        },
        // Use object structure for data points to include metadata
        data: event.readings.map((r) => ({
          // Convert glucose value to preferred units
          value: [
            normalizeTime(r.timestamp),
            convertGlucose(r.value, normalizedUnits),
          ],
          originalDate: r.timestamp,
        })),
      };
    });

    // Create bar series for treatments (carbs)
    const barSeries = hasCarbData
      ? sortedEvents
          .map((event, index) => {
            const visuals = getEventVisuals(index);
            const eventStart = new Date(event.startTime);
            const eventEnd = new Date(event.endTime);

            // Add a buffer to find relevant treatments around the event
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
            const seriesName = format(startDate, "EEE, MMM d") + " Carbs";

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
              data: eventTreatments.map((t) => ({
                value: [normalizeTime(t.date), t.carbs],
                originalDate: t.date,
                originalCarbs: t.carbs,
              })),
            };
          })
          .filter(Boolean)
      : [];

    // Configure Grid
    const grid = hasCarbData
      ? [
          {
            left: "5%",
            right: "5%",
            top: "10%",
            height: "55%",
            containLabel: true,
          }, // Top: Glucose
          {
            left: "5%",
            right: "5%",
            top: "70%",
            height: "15%",
            containLabel: true,
          }, // Bottom: Carbs
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

    // Configure X-Axis
    const xAxis = hasCarbData
      ? [
          {
            type: "time",
            gridIndex: 0,
            axisLabel: { show: false }, // Hide labels for top axis
            axisTick: { show: false },
          },
          {
            type: "time",
            gridIndex: 1,
            axisLabel: {
              formatter: "{HH}:{mm}",
            },
          },
        ]
      : [
          {
            type: "time",
            axisLabel: {
              formatter: "{HH}:{mm}",
            },
          },
        ];

    // Configure Y-Axis
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
        trigger: "item", // Changed to item for better handling of mixed series
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          // params is a single data point since trigger is 'item'
          const p = params;
          const time = new Date(p.data.value[0] as number);
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
      legend: {
        show: true,
        bottom: 0,
        type: "scroll",
      },
      grid: grid,
      xAxis: xAxis,
      yAxis: yAxis,
      series: [
        ...lineSeries,
        // Threshold lines (only on top grid)
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
  }, [cluster, units, treatments]);

  return (
    <div ref={containerRef} className="w-full h-96">
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge={true}
      />
    </div>
  );
}
