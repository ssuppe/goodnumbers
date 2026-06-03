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
  VisualMapComponent,
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
  VisualMapComponent,
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

      // 1. Group Events by Day to eliminate 'ghosting' and fix highlighting
      const dayEventsMap: Record<
        string,
        {
          events: typeof validEvents;
          color: string;
          dayIndex: number;
        }
      > = {};

      const uniqueDays = Array.from(
        new Set(
          validEvents.map((e) =>
            format(getLocalWallClockDate(e.startTime), "EEE, MMM d"),
          ),
        ),
      );

      validEvents.forEach((event) => {
        const dayName = format(
          getLocalWallClockDate(event.startTime),
          "EEE, MMM d",
        );
        const dayIndex = uniqueDays.indexOf(dayName);
        const visuals = getEventVisuals(dayIndex);

        if (!dayEventsMap[dayName]) {
          dayEventsMap[dayName] = {
            events: [],
            color: visuals.color,
            dayIndex,
          };
        }
        dayEventsMap[dayName].events.push(event);
      });

      // 2. Generate ONE Line Series and ONE visualMap per day
      let seriesCounter = 0;
      Object.entries(dayEventsMap).forEach(([dayName, dayData]) => {
        const { events, color } = dayData;

        // Collect and sort all readings for this day
        const allReadingsMap: Record<
          number,
          { value: [number, number]; originalDate: string }
        > = {};
        const highlightRanges: { start: number; end: number }[] = [];

        events.forEach((event) => {
          const normalizedStartTime = normalizeTime(
            event.startTime,
            boundaryHour,
          );

          if (isNaN(normalizedStartTime)) return;

          const originalStartTimeMillis = new Date(event.startTime).getTime();
          const durationMillis =
            new Date(event.endTime).getTime() - originalStartTimeMillis;
          const normalizedEndTime = normalizedStartTime + durationMillis;

          // Add highlight range - Only if valid
          if (
            !isNaN(normalizedEndTime) &&
            normalizedEndTime > normalizedStartTime
          ) {
            highlightRanges.push({
              start: normalizedStartTime,
              end: normalizedEndTime,
            });
          }

          event.readings.forEach((r) => {
            const originalReadingTime = new Date(r.timestamp).getTime();
            const offset = originalReadingTime - originalStartTimeMillis;
            const glucoseValue = convertGlucose(r.value, normalizedUnits);
            if (isNaN(originalReadingTime) || isNaN(glucoseValue)) return;

            const normalizedTime = normalizedStartTime + offset;

            // HARDENING: Critical guard against NaN coordinates
            if (isNaN(normalizedTime)) return;

            if (!allReadingsMap[normalizedTime]) {
              allReadingsMap[normalizedTime] = {
                value: [normalizedTime, glucoseValue],
                originalDate: r.timestamp,
              };
            }
          });
        });

        const seriesData = Object.values(allReadingsMap).sort(
          (a, b) => a.value[0] - b.value[0],
        );

        // STABILITY: ECharts visualMap crashes if series has < 2 points
        if (seriesData.length < 2) return;

        // --- VALUE SCAN: Identify every dot above High or below Low ---
        const thresholds = getClinicalThresholds(normalizedUnits);
        let excursionStart: number | null = null;
        
        seriesData.forEach((point, i) => {
          const val = point.value[1];
          const time = point.value[0];
          const isOut = val >= thresholds.high || val <= thresholds.low;
          
          if (isOut) {
            if (excursionStart === null) excursionStart = time;
          } else {
            if (excursionStart !== null) {
              highlightRanges.push({ start: excursionStart, end: time });
              excursionStart = null;
            }
          }
          // Handle end of series
          if (i === seriesData.length - 1 && excursionStart !== null) {
            highlightRanges.push({ start: excursionStart, end: time });
          }
        });

        // --- GAP FILLING: Create strictly non-overlapping pieces ---
        const sortedRanges = highlightRanges.sort((a, b) => a.start - b.start);
        const mergedRanges: { start: number; end: number }[] = [];
        if (sortedRanges.length > 0) {
          let current = sortedRanges[0];
          for (let i = 1; i < sortedRanges.length; i++) {
            if (sortedRanges[i].start <= current.end) {
              current.end = Math.max(current.end, sortedRanges[i].end);
            } else {
              mergedRanges.push(current);
              current = sortedRanges[i];
            }
          }
          mergedRanges.push(current);
        }

        const pieces: {
          gte?: number;
          lte?: number;
          color: string;
        }[] = [];
        if (mergedRanges.length > 0) {
          // Lead-in faded
          pieces.push({
            gte: -1e15,
            lte: mergedRanges[0].start,
            color: `${color}33`,
          });
          // Alternate full and faded
          mergedRanges.forEach((range, i) => {
            pieces.push({ gte: range.start, lte: range.end, color: color });
            const next = mergedRanges[i + 1];
            if (next) {
              pieces.push({
                gte: range.end,
                lte: next.start,
                color: `${color}33`,
              });
            }
          });
          // Tail-out faded
          pieces.push({
            gte: mergedRanges[mergedRanges.length - 1].end,
            lte: 1e15,
            color: `${color}33`,
          });
        } else {
          // Catch-all faded
          pieces.push({ gte: -1e15, lte: 1e15, color: `${color}33` });
        }

        // IMPORTANT: Pieces MUST be sorted by their mapping values (Dimension 0 / time)
        // for ECharts to render multiple segments correctly.
        const sortedPieces = pieces.sort((a, b) => (a.lte ?? 0) - (b.lte ?? 0));

        // Push visualMap ONLY IF the series is also added
        visualMaps.push({
          show: false,
          dimension: 0,
          seriesIndex: seriesCounter,
          gridIndex: 0,
          pieces: sortedPieces,
        });

        series.push({
          name: dayName,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: seriesData,
          showSymbol: false,
          smooth: false, // Disable smoothing for coordinate safety
          lineStyle: { width: 3 },
          emphasis: { focus: "series", lineStyle: { width: 5 } },
          blur: { lineStyle: { opacity: 0.15 } },
          // markLine only on the first actual series
          markLine:
            seriesCounter === 0
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

        seriesCounter++;
      });

      // 4. Group and Add Bar Series (Treatments) - Split by day for linked highlighting
      const dayTreatmentsMap: Record<
        string,
        { carbs: object[]; insulin: object[]; color: string }
      > = {};

      validEvents.forEach((event) => {
        const dayName = format(
          getLocalWallClockDate(event.startTime),
          "EEE, MMM d",
        );
        const dayIndex = uniqueDays.indexOf(dayName);
        const visuals = getEventVisuals(dayIndex);

        if (!dayTreatmentsMap[dayName]) {
          dayTreatmentsMap[dayName] = {
            carbs: [],
            insulin: [],
            color: visuals.color,
          };
        }

        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();
        const normalizedStartTime = normalizeTime(event.startTime, boundaryHour);
        const searchStart = eventStart - TREATMENT_BUFFER_MINUTES * 60000;
        const searchEnd = eventEnd + TREATMENT_BUFFER_MINUTES * 60000;

        treatments.forEach((t) => {
          const tTime = new Date(t.date).getTime();
          if (tTime >= searchStart && tTime <= searchEnd) {
            const offset = tTime - eventStart;
            // Check for duplicates within this day (multiple events can share treatments)
            const isDuplicateCarb = dayTreatmentsMap[dayName].carbs.some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (prev: any) =>
                (prev as { originalDate: string }).originalDate === t.date,
            );
            const isDuplicateInsulin = dayTreatmentsMap[dayName].insulin.some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (prev: any) =>
                (prev as { originalDate: string }).originalDate === t.date,
            );

            if (t.carbs && t.carbs > 0 && !isDuplicateCarb) {
              dayTreatmentsMap[dayName].carbs.push({
                name: dayName,
                value: [normalizedStartTime + offset, t.carbs],
                originalDate: t.date,
                originalValue: t.carbs,
                treatmentType: "carbs",
              });
            }
            if (t.insulin && t.insulin > 0 && !isDuplicateInsulin) {
              dayTreatmentsMap[dayName].insulin.push({
                name: dayName,
                value: [normalizedStartTime + offset, t.insulin],
                originalDate: t.date,
                originalValue: t.insulin,
                treatmentType: "insulin",
              });
            }
          }
        });
      });

      const hasCarbData = treatments.some((t) => t.carbs && t.carbs > 0);
      const hasInsulinData = treatments.some((t) => t.insulin && t.insulin > 0);

      Object.entries(dayTreatmentsMap).forEach(([dayName, data]) => {
        if (data.carbs.length > 0) {
          series.push({
            name: dayName,
            type: "bar",
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: data.carbs,
            itemStyle: { color: data.color, opacity: 0.8 },
            barWidth: 8,
            emphasis: { focus: "series" },
            blur: { itemStyle: { opacity: 0.15 } },
          });
        }
        if (data.insulin.length > 0) {
          series.push({
            name: dayName,
            type: "bar",
            xAxisIndex: hasCarbData ? 2 : 1,
            yAxisIndex: hasCarbData ? 2 : 1,
            data: data.insulin,
            itemStyle: { color: data.color, opacity: 0.8 },
            barWidth: 8,
            emphasis: { focus: "series" },
            blur: { itemStyle: { opacity: 0.15 } },
          });
        }
      });

      // --- Precise Vertical Layout ---
      const commonDomain = calculateCommonDomain(
        series as { data: { value: (number | string)[] }[] }[],
        30,
      );

      const LEFT_MARGIN = 90;
      const TITLE_GAP = 65;

      const grid: object[] = [
        {
          top: "5%",
          left: LEFT_MARGIN,
          right: 40,
          height: hasCarbData || hasInsulinData ? "48%" : "80%",
          containLabel: false, // Force alignment
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
          nameGap: TITLE_GAP,
          min: (v: { min: number }) => Math.floor(v.min * 0.9),
          max: (v: { max: number }) => Math.ceil(v.max * 1.1),
        },
      ];

      if (hasCarbData) {
        grid.push({
          left: LEFT_MARGIN,
          right: 40,
          top: "60%", // Tight gap from main chart
          height: hasInsulinData ? "16%" : "30%",
          containLabel: false,
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
          nameGap: TITLE_GAP,
          splitLine: { show: false },
        });
      }
      if (hasInsulinData) {
        grid.push({
          left: LEFT_MARGIN,
          right: 40,
          top: hasCarbData ? "79%" : "60%", // Very tight gap between bars
          height: hasCarbData ? "16%" : "30%",
          containLabel: false,
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
          nameGap: TITLE_GAP,
          splitLine: { show: false },
        });
      }

      const finalOptions = {
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "line",
            link: { xAxisIndex: "all" },
            label: { backgroundColor: "#777" },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (params: any) => {
            const pArray = Array.isArray(params) ? params : [params];
            if (pArray.length === 0) return "";

            const firstPoint = pArray[0];
            const dateSource = (firstPoint.data?.originalDate ||
              firstPoint.data?.value?.[0] ||
              firstPoint.value?.[0]) as string | number;

            let timeStr = "";
            if (typeof dateSource === "string") {
              timeStr = format(getLocalWallClockDate(dateSource), "h:mm a");
            } else {
              timeStr = formatAxisLabel(Number(dateSource));
            }

            let content = `<div style="font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 5px; padding-bottom: 2px;">${timeStr}</div>`;

            pArray.forEach((p: any) => {
              if (!p.data) return;
              const color = p.color;
              content += `<div style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">`;
              content += `<span><span style="display:inline-block;margin-right:5px;border-radius:10px;width:9px;height:9px;background-color:${color};"></span>${p.seriesName}</span>`;

              if (p.seriesType === "line") {
                const val = p.data.value[1];
                content += `<strong>${val}</strong>`;
              } else {
                const label =
                  p.data.treatmentType === "carbs" ? "Carbs" : "Insulin";
                const unit = p.data.treatmentType === "carbs" ? "g" : "u";
                content += `<span>${label}: <strong>${p.data.originalValue}${unit}</strong></span>`;
              }
              content += `</div>`;
            });
            return content;
          },
        },
        axisPointer: {
          link: { xAxisIndex: "all" },
        },
        visualMap: visualMaps,
        legend: { show: true, bottom: 0, type: "scroll" },
        grid,
        xAxis,
        yAxis,
        series,
      };

      return finalOptions;
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
        opts={{ renderer: "canvas" }}
        notMerge={true}
        onEvents={onEvents}
      />
    </div>
  );
}
