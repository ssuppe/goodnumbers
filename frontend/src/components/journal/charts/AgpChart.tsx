import React, { useMemo, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { LineChart, CustomChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from "echarts/components";
import { CHART_THEME } from "../../../lib/chartTheme";
import { getClinicalThresholds, type GlucoseUnit } from "../../../lib/agpUtils";

// Register ECharts components to keep bundle size optimized
echarts.use([
  CanvasRenderer,
  SVGRenderer,
  LineChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
]);

export interface AgpDataPoint {
  time: string;
  p5: number | null;
  p25: number | null;
  median: number | null;
  mean: number | null;
  p75: number | null;
  p95: number | null;
}

interface AgpChartProps {
  data: AgpDataPoint[];
  units: GlucoseUnit;
}

interface RenderItemParams {
  coordSys: { width: number; height: number; x: number; y: number };
  dataIndex: number;
}

interface RenderItemApi {
  value: (index: number) => number;
  coord: (data: number[]) => number[];
  size: (dataSize: number[], dataVal: number[]) => number[];
  style: (style: object) => object;
}

export function AgpChart({ data, units }: AgpChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mobile responsiveness
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;

    const chartInstance = chartRef.current.getEchartsInstance();
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.resize();
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const options = useMemo(() => {
    if (!data || data.length === 0) return null;

    const timeData = data.map((d) => d.time);
    const thresholds = getClinicalThresholds(units);

    // Prepare data series
    const medianData = data.map((d) => d.median);
    const meanData = data.map((d) => d.mean);

    // Custom series for bands expect [time, lower, upper]
    const p5_95Data = data.map((d) => [d.time, d.p5, d.p95]);
    const p25_75Data = data.map((d) => [d.time, d.p25, d.p75]);

    const formatTooltipValue = (val: number | undefined) =>
      val != null ? val.toFixed(units === "MMOL" ? 1 : 0) : "N/A";

    // Calculate overall max value for Y-axis
    let overallMax = 0;
    data.forEach((d) => {
      overallMax = Math.max(
        overallMax,
        d.p5 ?? 0,
        d.p25 ?? 0,
        d.median ?? 0,
        d.mean ?? 0,
        d.p75 ?? 0,
        d.p95 ?? 0,
      );
    });
    // Add 1% buffer and round up to the next sensible value
    let yAxisMax = overallMax * 1.01;
    if (units === "MGDL") {
      yAxisMax = Math.ceil(yAxisMax / 10) * 10;
    } else {
      // MMOL
      yAxisMax = Math.ceil(yAxisMax * 10) / 10;
    }

    return {
      animation: true,
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#eee",
        borderWidth: 1,
        padding: 12,
        textStyle: { color: "#333" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const point = data[index];
          if (!point) return "";

          // Helper for dots
          const dot = (color: string) =>
            `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>`;
          const dash = (color: string) =>
            `<span style="display:inline-block;margin-right:6px;width:12px;height:2px;background-color:${color};vertical-align:middle;"></span>`;

          return `
            <div class="font-bold mb-2 text-base">${point.time}</div>
            
            <!-- Median (Primary) -->
            <div class="flex items-center mb-1">
              ${dot(CHART_THEME.medianLine)}
              <span class="font-bold">Median: ${formatTooltipValue(point.median ?? undefined)}</span>
            </div>

            <!-- 50% Range (Secondary) -->
            <div class="flex items-center mb-1 text-sm">
              ${dot(CHART_THEME.bands.inner)}
              <span>50% of Readings: ${formatTooltipValue(point.p25 ?? undefined)} - ${formatTooltipValue(point.p75 ?? undefined)}</span>
            </div>

            <!-- 90% Range (Tertiary) -->
            <div class="flex items-center mb-2 text-sm text-gray-600">
              ${dot(CHART_THEME.bands.outer)}
              <span>90% of Readings: ${formatTooltipValue(point.p5 ?? undefined)} - ${formatTooltipValue(point.p95 ?? undefined)}</span>
            </div>

            <!-- Average (Context) -->
            <div class="flex items-center pt-2 border-t border-gray-100 text-xs text-gray-500">
              ${dash(CHART_THEME.meanLine)}
              <span>Average: ${formatTooltipValue(point.mean ?? undefined)}</span>
            </div>
          `;
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
        type: "category",
        data: timeData,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          interval: (index: number, value: string) =>
            value.endsWith(":00") && parseInt(value.split(":")[0]) % 3 === 0,
        },
      },
      yAxis: {
        type: "value",
        name: `Glucose (${units === "MMOL" ? "mmol/L" : "mg/dL"})`,
        nameLocation: "middle",
        nameGap: 40,
        scale: true,
        max: yAxisMax,
        splitLine: { lineStyle: { type: "dashed", color: "#eee" } },
      },
      legend: {
        data: ["Median", "Mean", "5th-95th Percentile", "25th-75th Percentile"],
        bottom: 0,
      },
      series: [
        // 5th-95th Percentile Band (Lightest)
        {
          name: "5th-95th Percentile",
          type: "custom",
          renderItem: (params: RenderItemParams, api: RenderItemApi) => {
            const xValue = api.value(0);
            const lower = api.value(1);
            const upper = api.value(2);

            // HARDENING: Critical check for coordinate system existence
            if (lower == null || upper == null || xValue == null || isNaN(xValue))
              return;

            const start = api.coord([xValue, lower]);
            const end = api.coord([xValue, upper]);

            // HARDENING: ensure coord lookups didn't fail
            if (
              !start ||
              !end ||
              isNaN(start[0]) ||
              isNaN(start[1]) ||
              isNaN(end[0]) ||
              isNaN(end[1])
            )
              return;

            // Calculate width and padding
            const size = api.size([1, 0], [xValue, lower]);
            const bandWidth = size[0];
            const padding = 2; // 1px on each side
            const barWidth = Math.max(1, bandWidth - padding);

            const x = start[0];
            const y0 = start[1];
            const y1 = end[1];

            const height = Math.abs(y0 - y1);
            const y = Math.min(y0, y1);

            return {
              type: "rect",
              shape: {
                x: x - barWidth / 2,
                y: y,
                width: barWidth,
                height: height,
                r: [2, 2, 2, 2], // Rounded corners
              },
              style: {
                fill: CHART_THEME.bands.outer,
                stroke: "none",
              },
            };
          },
          data: p5_95Data.filter((d) => d[1] != null && d[2] != null),
          z: 0,
        },
        // 25th-75th Percentile Band (Darker)
        {
          name: "25th-75th Percentile",
          type: "custom",
          renderItem: (params: RenderItemParams, api: RenderItemApi) => {
            const xValue = api.value(0);
            const lower = api.value(1);
            const upper = api.value(2);
            if (lower == null || upper == null || xValue == null || isNaN(xValue))
              return;

            const start = api.coord([xValue, lower]);
            const end = api.coord([xValue, upper]);

            if (
              !start ||
              !end ||
              isNaN(start[0]) ||
              isNaN(start[1]) ||
              isNaN(end[0]) ||
              isNaN(end[1])
            )
              return;

            // Calculate width and padding
            const size = api.size([1, 0], [xValue, lower]);
            const bandWidth = size[0];
            const padding = 2;
            const barWidth = Math.max(1, bandWidth - padding);

            const x = start[0];
            const y0 = start[1];
            const y1 = end[1];

            const height = Math.abs(y0 - y1);
            const y = Math.min(y0, y1);

            return {
              type: "rect",
              shape: {
                x: x - barWidth / 2,
                y: y,
                width: barWidth,
                height: height,
                r: [2, 2, 2, 2], // Rounded corners
              },
              style: {
                fill: CHART_THEME.bands.inner,
                stroke: "none",
              },
            };
          },
          data: p25_75Data.filter((d) => d[1] != null && d[2] != null),
          z: 1,
        },
        // Mean Line
        {
          name: "Mean",
          type: "line",
          data: meanData,
          showSymbol: false,
          lineStyle: {
            color: CHART_THEME.meanLine,
            type: "dashed",
            width: 2,
          },
          z: 2,
          // Threshold Lines (Clinical)
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                yAxis: thresholds.high,
                lineStyle: { color: CHART_THEME.clinicalHigh, type: "dashed" },
                label: { formatter: "High", position: "end" },
              },
              {
                yAxis: thresholds.low,
                lineStyle: { color: CHART_THEME.clinicalLow, type: "dashed" },
                label: { formatter: "Low", position: "end" },
              },
            ],
          },
        },
        // Median Line
        {
          name: "Median",
          type: "line",
          data: medianData,
          showSymbol: false,
          lineStyle: {
            color: CHART_THEME.medianLine,
            width: 3,
          },
          z: 3,
          // Target Range Background (Success Zone)
          markArea: {
            silent: true,
            itemStyle: {
              color: "rgba(76, 175, 80, 0.2)",
            },
            data: [[{ yAxis: thresholds.low }, { yAxis: thresholds.high }]],
          },
        },
      ],
    };
  }, [data, units]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border rounded-lg text-gray-400">
        No AGP data available.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-80">
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
