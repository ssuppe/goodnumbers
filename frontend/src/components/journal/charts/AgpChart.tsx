import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import { LineChart, CustomChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent, // Added MarkArea
} from 'echarts/components';
import { CHART_THEME } from '../../../lib/chartTheme';
import { getClinicalThresholds, type GlucoseUnit } from '../../../lib/agpUtils';

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
  MarkAreaComponent, // Register MarkArea
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
  patientLowGoal?: number;
  patientHighGoal?: number;
}

export function AgpChart({ data, units, patientLowGoal, patientHighGoal }: AgpChartProps) {
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
      val != null ? val.toFixed(units === 'MMOL' ? 1 : 0) : 'N/A';

    return {
      animation: true,
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const index = params[0].dataIndex;
          const point = data[index];
          if (!point) return '';

          return `
            <div class="font-bold mb-1">${point.time}</div>
            <div class="text-xs">
              <div>Median: <strong>${formatTooltipValue(point.median ?? undefined)}</strong></div>
              <div>Average: ${formatTooltipValue(point.mean ?? undefined)}</div>
              <div class="mt-1 text-gray-500">Range (5th-95th):</div>
              <div>${formatTooltipValue(point.p5 ?? undefined)} - ${formatTooltipValue(point.p95 ?? undefined)}</div>
            </div>
          `;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: timeData,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          interval: (index: number, value: string) => 
            value.endsWith(':00') && parseInt(value.split(':')[0]) % 3 === 0
        }
      },
      yAxis: {
        type: 'value',
        name: `Glucose (${units === 'MMOL' ? 'mmol/L' : 'mg/dL'})`,
        nameLocation: 'middle',
        nameGap: 40,
        scale: true,
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
      },
      legend: {
        data: ['Median', 'Mean', '5th-95th Percentile', '25th-75th Percentile'],
        bottom: 0
      },
      series: [
        // Target Range Background (Success Zone)
        {
          type: 'line',
          markArea: {
            silent: true,
            itemStyle: {
              color: 'rgba(76, 175, 80, 0.2)' // Hardcoded soft green for success zone
            },
            data: [
              [
                { yAxis: thresholds.low },
                { yAxis: thresholds.high }
              ]
            ]
          }
        },
        // 5th-95th Percentile Band (Lightest)
        {
          name: '5th-95th Percentile',
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const xValue = api.value(0);
            const lower = api.value(1);
            const upper = api.value(2);
            
            if (lower == null || upper == null) return;

            const start = api.coord([xValue, lower]);
            const end = api.coord([xValue, upper]);
            const size = api.size([1, 0], [xValue, lower]); // Approx width of one category
            const width = size[0];
            
            const x = start[0];
            const y0 = start[1];
            const y1 = end[1];
            const bandWidth = params.coordSys.width / timeData.length;
            
            return {
              type: 'polygon',
              shape: {
                points: [
                  [x - bandWidth / 2, y0],
                  [x - bandWidth / 2, y1],
                  [x + bandWidth / 2, y1],
                  [x + bandWidth / 2, y0]
                ]
              },
              style: api.style({
                fill: CHART_THEME.bands.outer,
                stroke: 'none'
              })
            };
          },
          data: p5_95Data,
          z: 0
        },
        // 25th-75th Percentile Band (Darker)
        {
          name: '25th-75th Percentile',
          type: 'custom',
          renderItem: (params: any, api: any) => {
             const xValue = api.value(0);
             const lower = api.value(1);
             const upper = api.value(2);
             if (lower == null || upper == null) return;

             const start = api.coord([xValue, lower]);
             const end = api.coord([xValue, upper]);
             const bandWidth = params.coordSys.width / timeData.length;
             const x = start[0];
             const y0 = start[1];
             const y1 = end[1];

             return {
               type: 'polygon',
               shape: {
                 points: [
                   [x - bandWidth / 2, y0],
                   [x - bandWidth / 2, y1],
                   [x + bandWidth / 2, y1],
                   [x + bandWidth / 2, y0]
                 ]
               },
               style: api.style({
                 fill: CHART_THEME.bands.inner,
                 stroke: 'none'
               })
             };
          },
          data: p25_75Data,
          z: 1
        },
        // Mean Line
        {
          name: 'Mean',
          type: 'line',
          data: meanData,
          showSymbol: false,
          lineStyle: { 
            color: CHART_THEME.meanLine, 
            type: 'dashed', 
            width: 2 
          },
          z: 2
        },
        // Median Line
        {
          name: 'Median',
          type: 'line',
          data: medianData,
          showSymbol: false,
          lineStyle: { 
            color: CHART_THEME.medianLine, 
            width: 3 
          },
          z: 3
        },
        // Threshold Lines (Clinical)
        {
           type: 'line',
           markLine: {
             silent: true,
             symbol: 'none',
             data: [
               { 
                 yAxis: thresholds.high, 
                 lineStyle: { color: CHART_THEME.clinicalHigh, type: 'dashed' },
                 label: { formatter: 'High', position: 'end' }
               },
               { 
                 yAxis: thresholds.low, 
                 lineStyle: { color: CHART_THEME.clinicalLow, type: 'dashed' },
                 label: { formatter: 'Low', position: 'end' }
               }
             ]
           }
        }
      ]
    };
  }, [data, units, patientLowGoal, patientHighGoal]);

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
        style={{ height: '100%', width: '100%' }} 
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}