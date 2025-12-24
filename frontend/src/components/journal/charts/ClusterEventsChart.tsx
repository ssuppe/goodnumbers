import React, { useMemo, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
} from "echarts/components";
import { CHART_THEME } from "../../../lib/chartTheme";
import { getClinicalThresholds, type GlucoseUnit } from "../../../lib/agpUtils";
import type { GlycemicCluster } from "@goodnumbers/types";
import { format } from "date-fns";

// Register components
echarts.use([
  CanvasRenderer,
  SVGRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
]);

interface ClusterEventsChartProps {
  cluster: GlycemicCluster;
  units: GlucoseUnit;
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
    const thresholds = getClinicalThresholds(units);

    // Sort events by startTime to ensure legend is chronological
    const sortedEvents = [...cluster.events].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    // Create a series for each event in the cluster
    const series = sortedEvents.map((event, index) => {
      const visuals = getEventVisuals(index);

      // Format start date for series name (e.g., "Sun, Jan 1")
      const startDate = new Date(event.startTime);
      const seriesName = format(startDate, "EEE, MMM d");

      return {
        name: seriesName,
        type: "line",
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
          value: [normalizeTime(r.timestamp), r.value],
          originalDate: r.timestamp,
        })),
      };
    });

    return {
      tooltip: {
        trigger: "axis",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (!params.length) return "";
          // Access value from the first param's data object
          const firstParam = params[0];
          // Safely cast to number before passing to Date constructor
          const timeValue = firstParam.data.value[0];
          const time = new Date(timeValue as number);

          let html = `<div>${time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</div>`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          params.forEach((p: any) => {
            const color = p.color;
            const val = p.data.value[1];
            const dateStr = p.seriesName; // The series name is now the date
            html += `<div><span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${color};"></span>${dateStr}: <strong>${val}</strong></div>`;
          });
          return html;
        },
      },
      legend: {
        show: true,
        bottom: 0,
        type: "scroll",
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "time",
        axisLabel: {
          formatter: "{HH}:{mm}", // Show only time
        },
      },
      yAxis: {
        type: "value",
        min: (value: { min: number }) => Math.floor(value.min * 0.9),
        max: (value: { max: number }) => Math.ceil(value.max * 1.1),
        splitLine: { lineStyle: { type: "dashed", color: "#eee" } },
      },
      series: [
        ...series,
        // Threshold lines
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
        },
      ],
    };
  }, [cluster, units]);

  return (
    <div ref={containerRef} className="w-full h-64">
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
