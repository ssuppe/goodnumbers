'use client';

// --- Imports ---
import * as React from 'react';
import { useRef, useMemo } from 'react';
import { GlucoseUnits, NightscoutEntry } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
// No need to import 'echarts/core' explicitly when using ReactECharts unless using specific extensions
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
}

// --- Helper Functions ---

function processEntries(entries: NightscoutEntry[]): { dateString: string; glucose: number }[] {
  if (!entries || entries.length === 0) return [];
  const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
  return sortedEntries.map((entry) => ({
    dateString: new Date(entry.date).toISOString(),
    glucose: entry.sgv,
  }));
}

function getEventColor(index: number): string {
  // Higher contrast color palette with better accessibility
  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
  return colors[index % colors.length];
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Main Component ---

export function ClusterEventsChart({
  cluster,
  entries,
  units,
  patientLowGoal,
  patientHighGoal,
  title = 'Glycemic Event Cluster Analysis',
}: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  
  // Effect to refresh chart when needed
  React.useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart) {
      chart.resize();
    }
  }, [cluster, entries, units]);

  const processedEntries = useMemo(() => processEntries(entries), [entries]);

  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') return 'N/A';
    const fixedDecimals = units === 'mmol/L' ? 1 : 0;
    return value.toFixed(fixedDecimals);
  };

  const getTimeWindowData = useMemo(() => {
    const referenceDate = new Date();
    referenceDate.setHours(0, 0, 0, 0);

    const normalizeToReferenceDate = (timestamp: string): Date => {
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
    if (latestTimeOfDay + bufferAfterMinutes >= 24 * 60) {
      windowEndTime.setDate(windowEndTime.getDate() + 1);
      windowEndTime.setMinutes((latestTimeOfDay + bufferAfterMinutes) % (24 * 60));
    } else {
      windowEndTime.setMinutes(latestTimeOfDay + bufferAfterMinutes);
    }

    if (processedEntries.length === 0) {
      return { windowStartTime, windowEndTime, series: [], referenceDate };
    }

    const lineSeries = cluster.events.map((event, index) => {
      const normalizedStartTime = normalizeToReferenceDate(event.start_timestamp);
      const normalizedEndTime = normalizeToReferenceDate(event.end_timestamp);
      const extremeGlucoseValue = units === 'mmol/L' ? event.extreme_bg_mgdl / MG_DL_PER_MMOL_L : event.extreme_bg_mgdl;
      const originalStartDate = new Date(event.start_timestamp);
      const dateStr = originalStartDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const eventStartTime = new Date(event.start_timestamp);
      const eventEndTime = new Date(event.end_timestamp);
      const bufferStartTime = new Date(eventStartTime);
      bufferStartTime.setMinutes(eventStartTime.getMinutes() - bufferBeforeMinutes);
      const bufferEndTime = new Date(eventEndTime);
      bufferEndTime.setMinutes(eventEndTime.getMinutes() + bufferAfterMinutes);

      const eventGlucoseData = processedEntries
        .filter((g) => {
          const readingTime = new Date(g.dateString);
          return readingTime >= bufferStartTime && readingTime <= bufferEndTime;
        })
        .sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());

      const eventData = eventGlucoseData.map((g) => {
        const originalTime = new Date(g.dateString);
        const normalizedTime = normalizeToReferenceDate(g.dateString);
        const glucoseValue = units === 'mmol/L' ? g.glucose / MG_DL_PER_MMOL_L : g.glucose;
        const isInEventRange = originalTime >= eventStartTime && originalTime <= eventEndTime;
        return {
          value: [normalizedTime.toISOString(), glucoseValue],
          originalTime,
          originalDateString: g.dateString,
          originalGlucose: g.glucose,
          glucoseInUserUnits: glucoseValue,
          originalDateStr: originalTime.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          duration: event.duration_minutes,
          extreme: extremeGlucoseValue,
          extremeOriginal: event.extreme_bg_mgdl,
          eventType: event.event_type,
          isInEventRange,
        };
      });

      return {
        name: `Event ${index + 1} (${formatTime(event.start_timestamp)}, ${dateStr})`,
        type: 'line',
        smooth: false,
        symbol: 'circle',
        symbolSize: (val: any, params: any) => (params.data.isInEventRange ? 10 : 6),
        lineStyle: { 
          width: 3, 
          color: getEventColor(index),
          type: 'solid'
        },
        emphasis: {
          focus: 'series',
          lineStyle: { width: 5 },
          itemStyle: { 
            borderWidth: 3, 
            borderColor: '#FFFFFF'
          },
          z: 20,
        },
        itemStyle: {
          color: (params: any) => (params.data.isInEventRange ? getEventColor(index) : 'rgba(170, 170, 170, 0.5)'),
          opacity: (params: any) => (params.data.isInEventRange ? 1 : 0.6)
        },
        data: eventData,
        id: `event-line-${index}`,
      };
    });

    const allSeries = [...lineSeries];
    
    return { 
      windowStartTime, 
      windowEndTime, 
      series: allSeries, 
      referenceDate
    };
  }, [cluster, processedEntries, units]);

  const clinicalLow = units === 'mmol/L' ? 3.9 : 70;
  const clinicalHigh = units === 'mmol/L' ? 10 : 180;
  const adjustedPatientLowGoal =
    patientLowGoal && units === 'mmol/L' ? patientLowGoal / MG_DL_PER_MMOL_L : patientLowGoal;
  const adjustedPatientHighGoal =
    patientHighGoal && units === 'mmol/L' ? patientHighGoal / MG_DL_PER_MMOL_L : patientHighGoal;

  if (cluster.events.length === 0 || getTimeWindowData.series.length === 0 || processedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No event data available for this cluster.</p>
      </div>
    );
  }

  const subtitle = 'Events from different days aligned by time of day';
  const options = {
    // --- Basic chart options (title, tooltip, grid, axes, legend, interaction, blur) ---
    // ... (Keep these sections largely the same as your previous correct version) ...
    title: {
      text: title,
      subtext: subtitle,
      left: 'center',
      textStyle: { fontWeight: 'bold', fontSize: 18 },
      subtextStyle: { fontSize: 13, color: '#666', fontWeight: 'normal' },
      padding: [10, 0, 15, 0]
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ddd',
      borderWidth: 1,
      padding: 12,
      textStyle: {
        fontSize: 13,
        lineHeight: 20
      },
      formatter: (params: any) => {
        if (!params || !params.data) return '';
        if (!params?.value?.[0]) return '';
        const normalizedTime = new Date(params.value[0]);
        const formattedTime = normalizedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        
        // Get the original date if available
        const dateInfo = params.data.originalDateStr ? 
          `<div style="margin-bottom: 4px;">Date: ${params.data.originalDateStr}</div>` : '';
          
        // Include event type and duration if available
        const eventTypeInfo = params.data.eventType ? 
          `<div style="margin-bottom: 4px;">Type: ${params.data.eventType}</div>` : '';
        const durationInfo = params.data.duration ? 
          `<div style="margin-bottom: 4px;">Duration: ${params.data.duration} min</div>` : '';
        
        const glucoseValue = params.data.glucoseInUserUnits ?? 
          (Array.isArray(params.data.value) ? params.data.value[1] : null);
          
        if (glucoseValue === null || typeof glucoseValue === 'undefined') return '';
        
        const match = params.seriesName.match(/Event (\d+)/);
        const eventLabel = match ? `Event ${match[1]}` : params.seriesName;
        
        let content = `<div style="font-weight: bold; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 6px;">Time: ${formattedTime}</div>${dateInfo}`;
        content += `<div style="margin-bottom: 6px;"><span style="display:inline-block;margin-right:8px;border-radius:10px;width:10px;height:10px;background-color:${params.color};"></span><span style="font-weight: 500;">${eventLabel}:</span> <span style="margin-left: 5px; font-weight: bold;">${formatValue(glucoseValue)} ${units}</span></div>`;
        content += `${eventTypeInfo}${durationInfo}`;
        
        return content;
      },
      extraCssText: 'box-shadow: 0 3px 14px rgba(0,0,0,0.15); border-radius: 6px;'
    },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      min: getTimeWindowData.windowStartTime.toISOString(),
      max: getTimeWindowData.windowEndTime.toISOString(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (value: number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      axisPointer: {
        label: {
          formatter: (params: any) =>
            new Date(params.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      },
    },
    yAxis: {
      type: 'value',
      name: `Glucose (${units})`,
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: { 
        fontSize: 14,
        fontWeight: 'bold',
        padding: [0, 0, 15, 0]
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { 
        show: true,
        lineStyle: { 
          type: 'dashed',
          opacity: 0.6 
        } 
      },
    },
    series: [
      /* Series generated in getTimeWindowData are used here */ ...getTimeWindowData.series,
      {
        name: 'Clinical Low',
        type: 'line',
        data: [],
        tooltip: { show: false },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed', width: 2 },
          label: { 
            show: true, 
            position: 'end', 
            formatter: 'Low',
            fontSize: 12,
            fontWeight: 'bold',
            backgroundColor: '#fff',
            padding: [3, 6]
          },
          data: [{ yAxis: clinicalLow }],
        },
      },
      {
        name: 'Clinical High',
        type: 'line',
        data: [],
        tooltip: { show: false },
        markLine: {
          silent: true,
          lineStyle: { color: '#ff4d4f', type: 'dashed', width: 2 },
          label: { 
            show: true, 
            position: 'end', 
            formatter: 'High',
            fontSize: 12,
            fontWeight: 'bold',
            backgroundColor: '#fff',
            padding: [3, 6]
          },
          data: [{ yAxis: clinicalHigh }],
        },
      },
      ...(adjustedPatientLowGoal
        ? [
            {
              name: 'Patient Low Goal',
              type: 'line',
              data: [],
              tooltip: { show: false },
              markLine: {
                silent: true,
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
                label: { show: true, position: 'end', formatter: 'Target Low' },
                data: [{ yAxis: adjustedPatientLowGoal }],
              },
            },
          ]
        : []),
      ...(adjustedPatientHighGoal
        ? [
            {
              name: 'Patient High Goal',
              type: 'line',
              data: [],
              tooltip: { show: false },
              markLine: {
                silent: true,
                lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
                label: { show: true, position: 'end', formatter: 'Target High' },
                data: [{ yAxis: adjustedPatientHighGoal }],
              },
            },
          ]
        : []),
    ],
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: 10,
      padding: [10, 20],
      itemGap: 20,
      textStyle: {
        fontSize: 12
      },
      // Only include line series in the legend, not background series
      data: getTimeWindowData.series
        .filter((s) => s.name && !s.name.includes('Background'))
        .map((s) => s.name!),
      selected: getTimeWindowData.series
        .filter((s) => s.name && !s.name.includes('Background'))
        .reduce(
          (acc, series) => {
            acc[series.name!] = true;
            return acc;
          },
          {} as Record<string, boolean>,
        ),
      selectedMode: 'multiple'
    },
    // Controls what series are highlighted when hovering
    highlightPolicy: 'self',
    // Global emphasis settings - only affect line series
    emphasis: { 
      focus: 'self', 
      scale: false
    },
    // Turn off all animations
    animation: false,
    animationDuration: 0,
    animationEasing: 'linear',
    // Define how non-emphasized series appear
    blur: { 
      lineStyle: { color: '#DDDDDD', width: 1, opacity: 0.6 }, 
      itemStyle: { color: '#DDDDDD', opacity: 0.6 } 
    },
  };

  return (
    <div className="w-full h-[450px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground relative">
      <ReactECharts
        ref={chartRef}
        option={options}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
