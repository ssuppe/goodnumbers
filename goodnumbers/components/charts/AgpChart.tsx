'use client';

import * as React from 'react';
import { GlucoseUnits } from '@/types/nightscout';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { MG_DL_PER_MMOL_L } from '@/utils/utils';

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
  /** Specifies the units ('mg/dl' or 'mmol/L') for the glucose values in the `data` array. */
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
  title = 'Weekly overview (Ambulatory Glucose Profile)',
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
    const fixedDecimals = units === 'mmol/L' ? 1 : 0;
    return value.toFixed(fixedDecimals);
  };

  // Clinical target ranges (always shown)
  // debugger;
  const clinicalLow = units == 'mmol/L' ? 3.9 : 70;
  const clinicalHigh = units == 'mmol/L' ? 10 : 180;

  patientLowGoal = patientLowGoal && units == 'mmol/L' ? patientLowGoal / MG_DL_PER_MMOL_L : patientLowGoal;
  patientHighGoal = patientHighGoal && units == 'mmol/L' ? patientHighGoal / MG_DL_PER_MMOL_L : patientHighGoal;

  // Prepare data for ECharts
  const timeData = data.map((item) => item.time);

  // Extract series data, handling null values
  const medianData = data.map((item) => item.median ?? '-');
  const meanData = data.map((item) => item.mean ?? '-');

  // Create horizontal line series data - same value for all timepoints
  const clinicalLowData = timeData.map(() => clinicalLow);
  const clinicalHighData = timeData.map(() => clinicalHigh);

  // Patient goal data if provided
  const patientLowGoalData = patientLowGoal !== undefined ? timeData.map(() => patientLowGoal) : [];
  const patientHighGoalData = patientHighGoal !== undefined ? timeData.map(() => patientHighGoal) : [];

  // Create data arrays for the confidence bands
  const p5_95Data = data.map((item) => {
    const p5 = item.p5 ?? null;
    const p95 = item.p95 ?? null;

    // We need both values to create a valid band
    if (p5 === null || p95 === null) {
      return [item.time, null, null];
    }

    return [item.time, p5, p95];
  });

  const p25_75Data = data.map((item) => {
    const p25 = item.p25 ?? null;
    const p75 = item.p75 ?? null;

    // We need both values to create a valid band
    if (p25 === null || p75 === null) {
      return [item.time, null, null];
    }

    return [item.time, p25, p75];
  });

  // ECharts configuration
  const options = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontWeight: 'normal',
        fontSize: 16,
      },
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
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '35px', // Increase bottom margin to make room for legend
      containLabel: true,
    },
    // When user hovers over a series, highlight it and dim others
    highlightPolicy: 'visual',
    emphasis: {
      focus: 'series',
      scale: false, // Don't scale up the emphasized series
    },
    blur: {
      // Style for non-highlighted series - keep them visible but more subtle
      lineStyle: {
        opacity: 0.4, // Higher opacity to keep non-hovered lines visible
        width: 1,
      },
      areaStyle: {
        opacity: 0.3, // Higher opacity for areas
      },
    },
    legend: {
      show: true,
      type: 'scroll',
      orient: 'horizontal',
      bottom: 0,
      data: [
        'Median', 
        'Mean', 
        '25th-75th Percentile Band', 
        '5th-95th Percentile Band'
      ],
      selected: {
        // Ensure all items are selected by default
        'Median': true,
        'Mean': true,
        '25th-75th Percentile Band': true,
        '5th-95th Percentile Band': true
      },
      selectedMode: 'multiple', // Allow multiple selection
      textStyle: {
        fontSize: 12,
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeData,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        interval: function (index: number, value: string) {
          // Show every 2 hours (4 labels)
          return value.endsWith(':00') && parseInt(value.split(':')[0]) % 2 === 0;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: `Glucose (${units})`,
      nameLocation: 'middle',
      nameGap: 50,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    series: [
      // 5th-95th percentile band (wider band, lighter color)
      {
        name: '5th-95th Percentile Band',
        type: 'custom',
        renderItem: function (params: any, api: any) {
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
                [x - xStep / 2, y0],
                [x - xStep / 2, y1],
                [x + xStep / 2, y1],
                [x + xStep / 2, y0],
              ],
            },
            style: api.style({
              fill: 'rgba(120, 140, 180, 0.25)',
              stroke: 'none',
            }),
            emphasis: {
              style: {
                fill: 'rgba(120, 140, 180, 0.5)',
                stroke: 'rgba(100, 120, 160, 0.8)',
                lineWidth: 1,
              }
            },
            blur: {
              style: {
                fill: 'rgba(200, 200, 200, 0.1)',
                stroke: 'none',
              }
            }
          };
        },
        emphasis: {
          focus: 'series',
          z: 10
        },
        data: p5_95Data,
        z: 1,
      },

      // 25th-75th percentile band (narrower band, darker color)
      {
        name: '25th-75th Percentile Band',
        type: 'custom',
        renderItem: function (params: any, api: any) {
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
                [x - xStep / 2, y0],
                [x - xStep / 2, y1],
                [x + xStep / 2, y1],
                [x + xStep / 2, y0],
              ],
            },
            style: api.style({
              fill: 'rgba(90, 110, 150, 0.35)',
              stroke: 'none',
            }),
            emphasis: {
              style: {
                fill: 'rgba(90, 110, 150, 0.6)',
                stroke: 'rgba(70, 90, 130, 0.8)',
                lineWidth: 1,
              }
            },
            blur: {
              style: {
                fill: 'rgba(180, 180, 180, 0.1)',
                stroke: 'none',
              }
            }
          };
        },
        emphasis: {
          focus: 'series',
          z: 20
        },
        data: p25_75Data,
        z: 2,
      },

      // Mean line (less prominent)
      {
        name: 'Mean',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 1, // Slightly thinner by default
          type: 'dashed', // Dashed line for mean
          color: 'rgba(70, 90, 130, 0.8)',
        },
        emphasis: {
          // Highlight effect when hovering
          focus: 'series',
          lineStyle: {
            width: 4, // Thicker on hover
            type: 'dashed',
            color: 'rgba(70, 90, 130, 1)',
          },
          // Apply stronger effect with z-index change to bring the series to front
          z: 30
        },
        data: meanData,
        z: 3,
      },

      // Median line (most prominent)
      {
        name: 'Median',
        type: 'line',
        symbol: 'none',
        emphasis: {
          focus: 'series',
          lineStyle: {
            width: 5, // Even thicker on hover
            color: 'rgb(70, 90, 130)',
          },
          // Apply stronger effect with z-index change to bring the series to front
          z: 40
        },
        lineStyle: {
          width: 1.5, // Slightly thinner by default
          color: 'rgb(70, 90, 130)',
        },
        data: medianData,
        z: 4,
      },

      // Clinical low threshold line
      {
        name: 'Clinical Low',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 1,
          type: 'dashed',
          color: '#ff4d4f',
        },
        emphasis: {
          // Never highlight threshold lines on hover
          disabled: true,
          // Keep them visible but slightly transparent when other elements are hovered
          lineStyle: {
            width: 1,
            type: 'dashed',
            color: 'rgba(255, 77, 79, 0.6)',
          },
        },
        blur: {
          lineStyle: {
            width: 1,
            type: 'dashed',
            color: 'rgba(255, 77, 79, 0.4)',
          },
        },
        data: clinicalLowData,
        z: 0,
        tooltip: {
          show: false,
        },
        label: {
          show: true,
          position: 'end',
          formatter: 'Low',
        },
      },

      // Clinical high threshold line
      {
        name: 'Clinical High',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 1,
          type: 'dashed',
          color: '#ff4d4f',
        },
        emphasis: {
          // Never highlight threshold lines on hover
          disabled: true,
          // Keep them visible but slightly transparent when other elements are hovered
          lineStyle: {
            width: 1,
            type: 'dashed',
            color: 'rgba(255, 77, 79, 0.6)',
          },
        },
        blur: {
          lineStyle: {
            width: 1,
            type: 'dashed',
            color: 'rgba(255, 77, 79, 0.4)',
          },
        },
        data: clinicalHighData,
        z: 0,
        tooltip: {
          show: false,
        },
        label: {
          show: true,
          position: 'end',
          formatter: 'High',
        },
      },

      // Patient low goal line (if provided)
      ...(patientLowGoalData.length > 0
        ? [
            {
              name: 'Patient Low Goal',
              type: 'line',
              symbol: 'none',
              lineStyle: {
                width: 1,
                color: '#52c41a',
              },
              emphasis: {
                // Never highlight goal lines on hover
                disabled: true,
                // Keep them visible but slightly transparent when other elements are hovered
                lineStyle: {
                  width: 1,
                  color: 'rgba(82, 196, 26, 0.6)',
                },
              },
              blur: {
                lineStyle: {
                  width: 1,
                  color: 'rgba(82, 196, 26, 0.4)',
                },
              },
              data: patientLowGoalData,
              z: 0,
              tooltip: {
                show: false,
              },
              label: {
                show: true,
                position: 'end',
                formatter: 'Target Low',
              },
            },
          ]
        : []),

      // Patient high goal line (if provided)
      ...(patientHighGoalData.length > 0
        ? [
            {
              name: 'Patient High Goal',
              type: 'line',
              symbol: 'none',
              lineStyle: {
                width: 1,
                color: '#52c41a',
              },
              emphasis: {
                // Never highlight goal lines on hover
                disabled: true,
                // Keep them visible but slightly transparent when other elements are hovered
                lineStyle: {
                  width: 1,
                  color: 'rgba(82, 196, 26, 0.6)',
                },
              },
              blur: {
                lineStyle: {
                  width: 1,
                  color: 'rgba(82, 196, 26, 0.4)',
                },
              },
              data: patientHighGoalData,
              z: 0,
              tooltip: {
                show: false,
              },
              label: {
                show: true,
                position: 'end',
                formatter: 'Target High',
              },
            },
          ]
        : []),
    ],
  };

  return (
    <div className="w-full h-[450px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <ReactECharts
        option={options}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // Using SVG renderer for better quality
      />
    </div>
  );
}
