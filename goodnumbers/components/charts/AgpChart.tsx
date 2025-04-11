'use client';

import * as React from 'react';
import { GlucoseUnits } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

/**
 * Defines the structure for a single data point in the AGP chart's data array.
 * Each object represents aggregated glucose statistics for one 30-minute time slot.
 * All glucose values (p5, p25, median, etc.) MUST be pre-calculated
 * in the units specified by the `units` prop passed to the chart component.
 * Using `null` allows handling time slots with insufficient data.
 */
export interface AgpDataPoint {
  /** Time label for the X-axis (e.g., "00:00", "00:30", ..., "23:30") */
  time: string;
  /** 5th percentile glucose value (or null if insufficient data) */
  p5: number | null;
  /** 25th percentile glucose value (or null) */
  p25: number | null;
  /** Median (50th percentile) glucose value (or null) */
  median: number | null;
  /** Mean (average) glucose value (or null) */
  mean: number | null;
  /** 75th percentile glucose value (or null) */
  p75: number | null;
  /** 95th percentile glucose value (or null) */
  p95: number | null;
}

/**
 * Defines the props accepted by the AgpChart component.
 */
export interface AgpChartProps {
  /**
   * The core data for the chart: an array of aggregated data points.
   * Should contain exactly 48 points for a full 24-hour cycle (one per 30 mins).
   */
  data: AgpDataPoint[];
  /** Specifies the units ('mg/dl' or 'mmol/l') for the glucose values in the `data` array. */
  units: GlucoseUnits;
  /** Optional patient-specific low threshold */
  patientLowGoal?: number;
  /** Optional patient-specific high threshold */
  patientHighGoal?: number;
  /** An optional title to display above the chart. */
  title?: string;
}

/**
 * Renders an Ambulatory Glucose Profile (AGP) chart using Apache ECharts.
 * Displays median and mean glucose lines, along with percentile bands (5-95th, 25-75th)
 * over a 24-hour period, aggregated into 30-minute intervals.
 * Includes an interactive tooltip showing detailed stats for the hovered time slot.
 */
export function AgpChart({
  data,
  units,
  patientLowGoal,
  patientHighGoal,
  title = "Weekly overview (Ambulatory Glucose Profile)"
}: AgpChartProps) {
  // Provide a fallback message if data is not available
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No AGP data available.</p>
      </div>
    );
  }

  // Helper function to format glucose values for display in the tooltip
  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') {
      return 'N/A'; // Display for missing data points
    }
    // Show 1 decimal place for mmol/L, 0 for mg/dL
    const fixedDecimals = units === 'mmol/l' ? 1 : 0;
    return value.toFixed(fixedDecimals);
  };

  // Prepare data for ECharts
  const timeData = data.map(item => item.time);
  
  // Extract series data, handling null values
  const medianData = data.map(item => item.median ?? '-');
  const meanData = data.map(item => item.mean ?? '-');

  // Create data arrays for the confidence bands
  const p5_95Data = data.map(item => {
    const p5 = item.p5 ?? null;
    const p95 = item.p95 ?? null;
    
    // We need both values to create a valid band
    if (p5 === null || p95 === null) {
      return [item.time, null, null];
    }
    
    return [item.time, p5, p95];
  });
  
  const p25_75Data = data.map(item => {
    const p25 = item.p25 ?? null;
    const p75 = item.p75 ?? null;
    
    // We need both values to create a valid band
    if (p25 === null || p75 === null) {
      return [item.time, null, null];
    }
    
    return [item.time, p25, p75];
  });

  // Clinical target ranges (always shown)
  const clinicalLow = units === 'mmol/l' ? 3.9 : 70;
  const clinicalHigh = units === 'mmol/l' ? 10 : 180;

  // Prepare markLines for target ranges
  const markLines = [
    {
      name: 'Clinical Ranges',
      symbol: 'none',
      lineStyle: {
        color: '#ff4d4f',
        type: 'dashed',
        width: 1
      },
      label: {
        formatter: '{b}',
        position: 'insideEndTop'
      },
      data: [
        [
          { name: 'Low', yAxis: clinicalLow, x: '5%' },
          { name: '', yAxis: clinicalLow, x: '95%' }
        ],
        [
          { name: 'High', yAxis: clinicalHigh, x: '5%' },
          { name: '', yAxis: clinicalHigh, x: '95%' }
        ]
      ]
    }
  ];

  // Add patient goal ranges if provided
  if (patientLowGoal !== undefined || patientHighGoal !== undefined) {
    markLines.push({
      name: 'Patient Goals',
      symbol: 'none',
      lineStyle: {
        color: '#52c41a',
        type: 'solid',
        width: 1
      },
      label: {
        formatter: '{b}',
        position: 'insideEndTop'
      },
      data: [
        ...(patientLowGoal !== undefined ? [
          [
            { name: 'Target Low', yAxis: patientLowGoal, x: '5%' },
            { name: '', yAxis: patientLowGoal, x: '95%' }
          ]
        ] : []),
        ...(patientHighGoal !== undefined ? [
          [
            { name: 'Target High', yAxis: patientHighGoal, x: '5%' },
            { name: '', yAxis: patientHighGoal, x: '95%' }
          ]
        ] : [])
      ]
    });
  }

  // ECharts configuration
  const options = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontWeight: 'normal',
        fontSize: 16
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function (params: any) {
        // Get the data point for the current time
        const index = params[0].dataIndex;
        const point = data[index];

        // Format the tooltip content
        let content = `<div style="font-weight: bold; margin-bottom: 5px;">Time: ${point.time}</div>`;
        content += `<div>Median: ${formatValue(point.median)} ${units}</div>`;
        content += `<div>Average: ${formatValue(point.mean)} ${units}</div>`;
        content += `<div>25th-75th: [${formatValue(point.p25)} - ${formatValue(point.p75)}] ${units}</div>`;
        content += `<div>5th-95th: [${formatValue(point.p5)} - ${formatValue(point.p95)}] ${units}</div>`;

        return content;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeData,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        interval: function (index: number, value: string) {
          // Show every 2 hours (4 labels)
          return value.endsWith(':00') && parseInt(value.split(':')[0]) % 2 === 0;
        }
      }
    },
    yAxis: {
      type: 'value',
      name: `Glucose (${units})`,
      nameLocation: 'middle',
      nameGap: 50,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    series: [
      // 5th-95th percentile band (wider band, lighter color)
      {
        name: '5th-95th Percentile Band',
        type: 'custom',
        renderItem: function(params: any, api: any) {
          const xValue = api.value(0);
          if (xValue == null) return;
          
          const lowerValue = api.value(1);
          const upperValue = api.value(2);
          
          // Skip if any value is missing
          if (lowerValue == null || upperValue == null) {
            return;
          }
          
          const xStart = params.coordSys.x;
          const xSize = params.coordSys.width;
          const xStep = xSize / timeData.length;
          
          const x = api.coord([api.value(0), 0])[0];
          const y0 = api.coord([0, lowerValue])[1];
          const y1 = api.coord([0, upperValue])[1];
          
          // Create polygon shape for the band
          return {
            type: 'polygon',
            shape: {
              points: [
                [x - xStep/2, y0],
                [x - xStep/2, y1],
                [x + xStep/2, y1],
                [x + xStep/2, y0]
              ]
            },
            style: {
              fill: 'rgba(120, 140, 180, 0.25)',
              stroke: 'none'
            }
          };
        },
        data: p5_95Data,
        z: 1
      },
      
      // 25th-75th percentile band (narrower band, darker color)
      {
        name: '25th-75th Percentile Band',
        type: 'custom',
        renderItem: function(params: any, api: any) {
          const xValue = api.value(0);
          if (xValue == null) return;
          
          const lowerValue = api.value(1);
          const upperValue = api.value(2);
          
          // Skip if any value is missing
          if (lowerValue == null || upperValue == null) {
            return;
          }
          
          const xStart = params.coordSys.x;
          const xSize = params.coordSys.width;
          const xStep = xSize / timeData.length;
          
          const x = api.coord([api.value(0), 0])[0];
          const y0 = api.coord([0, lowerValue])[1];
          const y1 = api.coord([0, upperValue])[1];
          
          // Create polygon shape for the band
          return {
            type: 'polygon',
            shape: {
              points: [
                [x - xStep/2, y0],
                [x - xStep/2, y1],
                [x + xStep/2, y1],
                [x + xStep/2, y0]
              ]
            },
            style: {
              fill: 'rgba(90, 110, 150, 0.35)',
              stroke: 'none'
            }
          };
        },
        data: p25_75Data,
        z: 2
      },

      // Mean line (less prominent)
      {
        name: 'Mean',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 1.5,
          type: 'dashed', // Dashed line for mean
          color: 'rgba(70, 90, 130, 0.8)'
        },
        data: meanData,
        z: 3
      },

      // Median line (most prominent)
      {
        name: 'Median',
        type: 'line',
        symbol: 'none',
        emphasis: {
          focus: 'series'
        },
        lineStyle: {
          width: 2,
          color: 'rgb(70, 90, 130)'
        },
        data: medianData,
        z: 4
      }
    ],
    markLine: {
      silent: true,
      data: markLines
    }
  };

  return (
    <div className="w-full h-[400px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <ReactECharts
        option={options}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // Using SVG renderer for better quality
      />
    </div>
  );
}