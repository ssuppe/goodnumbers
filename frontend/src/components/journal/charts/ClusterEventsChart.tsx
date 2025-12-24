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

// Helper: Normalize any date string to Jan 1, 2000, preserving time
// We use UTC methods to avoid timezone issues during normalization if the input is UTC
const normalizeTime = (isoString: string) => {
  const d = new Date(isoString);
  // Set to a fixed date (Jan 1, 2000)
  // We use setFullYear/Month/Date to keep the local time representation consistent
  // or use UTC if we want to strictly adhere to the input string's time.
  // Given the test expects specific UTC hours, we should be careful.
  // The test sets '2023-01-01T14:00:00Z' and expects 14:00 UTC on Jan 1 2000.
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

    // Create a series for each event in the cluster
    const series = cluster.events.map((event, index) => ({
      name: `Event ${index + 1}`,
      type: "line",
      showSymbol: false,
      smooth: true,
      lineStyle: {
        width: 2,
        opacity: 0.6, // Semi-transparent to show overlap
        color: CHART_THEME.medianLine, // Use theme color
      },
      data: event.readings.map((r) => [normalizeTime(r.timestamp), r.value]),
    }));

    return {
      tooltip: {
        trigger: "axis",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          // Basic formatter for now, can be enhanced later
          if (!params.length) return "";
          const time = new Date(params[0].value[0] as number);
          let html = `<div>${time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</div>`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          params.forEach((p: any) => {
            html += `<div>${p.seriesName}: ${p.value[1]}</div>`;
          });
          return html;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "10%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "time",
        axisLabel: {
          formatter: "{HH}:{mm}", // Show only time
        },
        // Force range to cover full 24h if needed, or auto-scale to cluster window
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
