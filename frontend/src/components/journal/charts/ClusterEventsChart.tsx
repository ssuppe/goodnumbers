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
  getLocalWallClockDate,
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

const TREATMENT_BUFFER_MINUTES = 180;

interface EChartsEventParams {
  seriesName: string;
}

const eventColors = [
  "#1976d2",
  "#264653",
  "#e76f51",
  "#2a9d8f",
  "#6d597a",
  "#bc6c25",
  "#457b9d",
  "#5d4037",
];

function getEventVisuals(index: number) {
  return {
    color: eventColors[index % eventColors.length],
  };
}

export function ClusterEventsChart({
  cluster,
  units,
  treatments = [],
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const boundaryHour = useMemo(() => {
    const relevantTreatmentTimestamps: string[] = [];
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
            relevantTreatmentTimestamps.push(t.date);
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

  const onEvents = useMemo(
    () => ({
      mouseover: (params: EChartsEventParams) => {
        const chartInstance = chartRef.current?.getEchartsInstance();
        if (chartInstance)
          chartInstance.dispatchAction({
            type: "highlight",
            seriesName: params.seriesName,
          });
      },
      mouseout: (params: EChartsEventParams) => {
        const chartInstance = chartRef.current?.getEchartsInstance();
        if (chartInstance)
          chartInstance.dispatchAction({
            type: "downplay",
            seriesName: params.seriesName,
          });
      },
    }),
    [],
  );

  const options = useMemo(() => {
    try {
      if (!cluster.events.length) return null;
      const isMmol = units === "MMOL";
      const normalizedUnits = (isMmol ? "MMOL" : "MGDL") as GlucoseUnit;
      const thresholds = getClinicalThresholds(normalizedUnits);

      const validEvents = [...cluster.events]
        .filter((e) => e.readings && e.readings.length >= 2)
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );

      if (validEvents.length === 0) return null;

      const series: object[] = [];
      const visualMaps: object[] = [];

      // Link by Day to allow shared naming/highlighting
      const uniqueDays = Array.from(
        new Set(
          validEvents.map((e) =>
            format(getLocalWallClockDate(e.startTime), "EEE, MMM d"),
          ),
        ),
      );

      validEvents.forEach((event, index) => {
        const normalizedStartTime = normalizeTime(
          event.startTime,
          boundaryHour,
        );
        const originalStartTimeMillis = new Date(event.startTime).getTime();
        const dayName = format(
          getLocalWallClockDate(event.startTime),
          "EEE, MMM d",
        );
        const dayIndex = uniqueDays.indexOf(dayName);
        const visuals = getEventVisuals(dayIndex);
        const durationMillis =
          new Date(event.endTime).getTime() - originalStartTimeMillis;
        const normalizedEndTime = normalizedStartTime + durationMillis;

        const seriesData = event.readings
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
          );

        series.push({
          name: dayName, // LINK: Used for highlighting treatment bars on same day
          type: "line",
          data: seriesData,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 3 },
          emphasis: { focus: "series", lineStyle: { width: 5 } },
          blur: { lineStyle: { opacity: 0.15 } },
          markLine:
            index === 0
              ? {
                  silent: true,
                  symbol: "none",
                  data: [
                    {
                      yAxis: thresholds.high,
                      lineStyle: {
                        color: CHART_THEME.clinicalHigh,
                        type: "dashed",
                      },
                    },
                    {
                      yAxis: thresholds.low,
                      lineStyle: {
                        color: CHART_THEME.clinicalLow,
                        type: "dashed",
                      },
                    },
                  ],
                }
              : undefined,
        });

        visualMaps.push({
          show: false,
          dimension: 0,
          seriesIndex: index,
          pieces: [
            {
              gt: -Infinity,
              lt: normalizedStartTime,
              color: `${visuals.color}33`,
            },
            {
              gte: normalizedStartTime,
              lte: normalizedEndTime,
              color: visuals.color,
            },
            { gt: normalizedEndTime, color: `${visuals.color}33` },
          ],
        });
      });

      const buildBarSeries = (
        type: "carbs" | "insulin",
        color: string,
        axisIndex: number,
      ) => {
        const data: object[] = [];
        validEvents.forEach((event) => {
          const eventStart = new Date(event.startTime).getTime();
          const normalizedStartTime = normalizeTime(
            event.startTime,
            boundaryHour,
          );
          const dayName = format(
            getLocalWallClockDate(event.startTime),
            "EEE, MMM d",
          );
          const eventStartTime = new Date(event.startTime).getTime();
          const eventEndTime = new Date(event.endTime).getTime();
          const searchStart = eventStartTime - TREATMENT_BUFFER_MINUTES * 60000;
          const searchEnd = eventEndTime + TREATMENT_BUFFER_MINUTES * 60000;

          treatments.forEach((t) => {
            const tTime = new Date(t.date).getTime();
            const val = type === "carbs" ? t.carbs : t.insulin;
            if (val && val > 0 && tTime >= searchStart && tTime <= searchEnd) {
              data.push({
                name: dayName, // LINK: Same name for linked highlight interaction
                value: [normalizedStartTime + (tTime - eventStart), val],
                originalDate: t.date,
                originalValue: val,
                treatmentType: type,
              });
            }
          });
        });
        if (data.length === 0) return null;
        return {
          name: type === "carbs" ? "Carbs" : "Insulin",
          type: "bar",
          xAxisIndex: axisIndex,
          yAxisIndex: axisIndex,
          data,
          itemStyle: { color, opacity: 0.8 },
          barWidth: 8,
        };
      };

      const hasCarbData = treatments.some((t) => t.carbs && t.carbs > 0);
      const hasInsulinData = treatments.some((t) => t.insulin && t.insulin > 0);
      const carbSeries = buildBarSeries("carbs", CHART_THEME.treatmentCarbs, 1);
      const insulinSeries = buildBarSeries(
        "insulin",
        CHART_THEME.treatmentInsulin,
        hasCarbData ? 2 : 1,
      );

      if (carbSeries) series.push(carbSeries);
      if (insulinSeries) series.push(insulinSeries);

      // --- Precise Vertical Layout ---
      const commonDomain = calculateCommonDomain(
        series as { data: { value: (number | string)[] }[] }[],
        30, // Tighter padding since data already has 3h context buffer
      );
      const grid: object[] = [
        {
          top: "8%",
          left: 80,
          right: 40,
          height: hasCarbData || hasInsulinData ? "50%" : "75%",
          containLabel: true,
        },
      ];
      const xAxis: object[] = [
        {
          type: "value",
          gridIndex: 0,
          min: commonDomain?.min,
          max: commonDomain?.max,
          axisLabel: { formatter: (v: number) => formatAxisLabel(v) },
          splitLine: { show: false },
        },
      ];
      const yAxis: object[] = [
        {
          type: "value",
          gridIndex: 0,
          name: `Glucose (${isMmol ? "mmol/L" : "mg/dL"})`,
          nameLocation: "middle",
          nameRotate: 90,
          nameGap: 45,
          min: (v: { min: number }) => Math.floor(v.min * 0.9),
          max: (v: { max: number }) => Math.ceil(v.max * 1.1),
        },
      ];

      if (hasCarbData) {
        grid.push({
          left: 80,
          right: 40,
          top: "65%",
          height: hasInsulinData ? "12%" : "25%",
          containLabel: true,
        });
        xAxis.push({
          type: "value",
          gridIndex: grid.length - 1,
          show: false,
          min: commonDomain?.min,
          max: commonDomain?.max,
        });
        yAxis.push({
          type: "value",
          gridIndex: grid.length - 1,
          name: "Carbs (g)",
          nameLocation: "middle",
          nameGap: 45,
          splitLine: { show: false },
        });
      }
      if (hasInsulinData) {
        grid.push({
          left: 80,
          right: 40,
          top: hasCarbData ? "82%" : "65%",
          height: hasCarbData ? "12%" : "25%",
          containLabel: true,
        });
        xAxis.push({
          type: "value",
          gridIndex: grid.length - 1,
          show: false,
          min: commonDomain?.min,
          max: commonDomain?.max,
        });
        yAxis.push({
          type: "value",
          gridIndex: grid.length - 1,
          name: "Insulin (u)",
          nameLocation: "middle",
          nameGap: 45,
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
            const timeStr =
              typeof dateSource === "string"
                ? format(getLocalWallClockDate(dateSource), "h:mm a")
                : formatAxisLabel(Number(dateSource));
            let content = `<div><span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${p.color};"></span>${p.seriesName}</div>`;
            content += `<div>${timeStr}</div>`;
            if (p.seriesType === "line") {
              content += `<div>Glucose: <strong>${p.data.value[1]}</strong> ${isMmol ? "mmol/L" : "mg/dL"}</div>`;
            } else {
              const label =
                p.data.treatmentType === "carbs" ? "Carbs" : "Insulin";
              const unit = p.data.treatmentType === "carbs" ? "g" : "u";
              content += `<div>${label}: <strong>${p.data.originalValue}${unit}</strong></div>`;
            }
            return content;
          },
        },
        visualMap: visualMaps,
        legend: { show: true, bottom: 0, type: "scroll" },
        grid,
        xAxis,
        yAxis,
        series,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ClusterEventsChart] Critical error:", msg);
      return null;
    }
  }, [cluster, units, treatments, boundaryHour]);

  if (!options)
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 border rounded-lg text-slate-400 italic">
        Unable to generate visualization.
      </div>
    );

  return (
    <div ref={containerRef} className="w-full h-96 min-h-[400px]">
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
