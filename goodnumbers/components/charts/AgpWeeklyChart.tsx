// src/components/charts/agp-chart.tsx
// Ensure this component is marked as a Client Component for Next.js App Router
'use client';

import * as React from 'react';
// Import necessary components from Recharts library
import {
  Area,
  AreaChart, // Using AreaChart for filled percentile bands
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip, // Base Recharts Tooltip component
  XAxis,
  YAxis,
} from 'recharts';
import { GlucoseUnits } from '@/types/nightscout';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '../ui/chart';

/**
 * Defines the structure for a single data point in the AGP chart's data array.
 * Each object represents aggregated glucose statistics for one 30-minute time slot.
 * All glucose values (p10, p25, median, etc.) MUST be pre-calculated
 * in the units specified by the `units` prop passed to the chart component.
 * Using `null` allows handling time slots with insufficient data.
 */
export interface AgpDataPoint {
  /** Time label for the X-axis (e.g., "00:00", "00:30", ..., "23:30") */
  time: string;
  /** 10th percentile glucose value (or null if insufficient data) */
  p10: number | null;
  /** 25th percentile glucose value (or null) */
  p25: number | null;
  /** Median (50th percentile) glucose value (or null) */
  median: number | null;
  /** Mean (average) glucose value (or null) */
  mean: number | null;
  /** 75th percentile glucose value (or null) */
  p75: number | null;
  /** 90th percentile glucose value (or null) */
  p90: number | null;
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
  /** An optional title to display above the chart. */
  title?: string;
}

// --- Chart Configuration ---

/**
 * Configuration object for the shadcn Chart components.
 * It maps data keys from `AgpDataPoint` to labels and colors.
 * Uses CSS variables (e.g., `hsl(var(--chart-1))`) for theme compatibility (light/dark mode).
 */
const chartConfig = {
  // Keys for actual plotted data or data used in tooltips
  median: {
    label: 'Median',
    color: 'hsl(var(--chart-1))', // Primary color for the median line
  },
  mean: {
    label: 'Average', // Used in tooltip
    // No color needed unless plotting the mean separately
  },
  // Keys used internally for area bounds, labels not strictly needed unless shown in legend
  p90: { label: '90th Percentile' },
  p75: { label: '75th Percentile' },
  p25: { label: '25th Percentile' },
  p10: { label: '10th Percentile' },
  // Define semantic names and colors for the visual bands themselves
  band_10_90: {
    label: '10th-90th Percentile',
    color: 'hsl(var(--chart-2))', // A secondary, often lighter color
  },
  band_25_75: {
    label: '25th-75th Percentile',
    color: 'hsl(var(--chart-1))', // Can reuse primary color, often slightly more opaque
  },
} satisfies ChartConfig; // `satisfies` provides type checking for the config object

// --- Chart Component ---

/**
 * Renders an Ambulatory Glucose Profile (AGP) chart.
 * Displays median glucose line and percentile bands (10-90th, 25-75th)
 * over a 24-hour period, aggregated into 30-minute intervals.
 * Includes an interactive tooltip showing detailed stats for the hovered time slot.
 */
export function AgpChart({ data, units, title }: AgpChartProps) {
  // Provide a fallback message if data is not available
  if (!data || data.length === 0) {
    // Consider a more visually appealing placeholder or loading state in a real app
    return (
      <div className="flex items-center justify-center h-[400px] w-full border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">No AGP data available.</p>
      </div>
    );
  }

  // Construct the Y-axis label dynamically based on the units prop
  const yAxisLabel = `Glucose (${units})`;

  /**
   * Helper function to format glucose values for display in the tooltip.
   * Handles null values and applies appropriate decimal places based on units.
   * @param value - The numeric glucose value or null.
   * @returns A formatted string representation of the value or "N/A".
   */
  const formatValue = (value: number | null): string => {
    if (value === null || typeof value === 'undefined') {
      return 'N/A'; // Display for missing data points
    }
    // Show 1 decimal place for mmol/L, 0 for mg/dL
    const fixedDecimals = units === 'mmol/l' ? 1 : 0;
    return value.toFixed(fixedDecimals);
  };

  return (
    // Outer container for padding, border, and shadow using Tailwind classes
    <div className="w-full h-[400px] p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      {/* Display the title if provided */}
      {title && <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>}
      {/* ChartContainer sets up context for shadcn chart components */}
      {/* Calculate height to account for title margin */}
      <ChartContainer config={chartConfig} className="w-full h-[calc(100%-40px)]">
        {/* ResponsiveContainer makes the chart fill its parent container */}
        <ResponsiveContainer width="100%" height="100%">
          {/* AreaChart is used because we need to fill the percentile bands */}
          <AreaChart
            data={data}
            // Define margins to prevent labels/axes from being cut off
            margin={{
              top: 5,
              right: 10, // Space for potential end labels
              left: 15, // Increased space for Y-axis label
              bottom: 5,
            }}
            // Improves accessibility by adding ARIA attributes
            accessibilityLayer
          >
            {/* Adds subtle horizontal grid lines for reference */}
            <CartesianGrid vertical={false} strokeDasharray="3 3" />

            {/* Defines the X-axis (Time) */}
            <XAxis
              dataKey="time" // Use the 'time' field from AgpDataPoint
              tickLine={false} // Hide the small ticks on the axis
              axisLine={false} // Hide the axis line itself for a cleaner look
              tickMargin={8} // Space between ticks and labels
              fontSize={12} // Adjust font size for readability
              // Recharts attempts to intelligently skip labels if they overlap
              // interval="preserveStartEnd" // Can force display of first/last ticks
              // You might need custom logic here if you have many ticks (e.g., show every hour)
            />

            {/* Defines the Y-axis (Glucose Level) */}
            <YAxis
              // Add the dynamic label, rotated and positioned
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                offset: -10, // Adjust offset to position label nicely
                style: { textAnchor: 'middle' },
              }}
              tickLine={false} // Hide tick lines
              axisLine={false} // Hide axis line
              tickMargin={8} // Space between ticks and labels
              fontSize={12}
              // Allow Recharts to automatically determine the min/max values ('auto')
              // Or set explicitly: domain={[0, units === 'mg/dl' ? 400 : 22]}
              domain={['auto', 'auto']}
              // Format the tick values (e.g., ensure whole numbers for mg/dl)
              tickFormatter={(value) => `${Math.round(value)}`}
              // Ensure a reasonable number of ticks are shown
              tickCount={6} // Example: Aim for roughly 6 ticks
            />

            {/* Configures the Tooltip behavior on hover */}
            <Tooltip
              // Show a dashed vertical line following the cursor
              cursor={{
                stroke: 'hsl(var(--muted-foreground))',
                strokeWidth: 1,
                strokeDasharray: '3 3',
              }}
              // Provide a custom rendering FUNCTION to the Recharts Tooltip's content prop
              content={({ active, payload, label }) => {
                // Check if the tooltip is active and has data
                if (active && payload && payload.length) {
                  // The actual data object for the hovered point is usually
                  // nested within the first item of the payload array.
                  const pointData = payload[0].payload as AgpDataPoint | undefined;

                  // Don't render if data structure is unexpected
                  if (!pointData) return null;

                  // Render the shadcn ChartTooltipContent component as the container
                  // and define the internal structure using the pointData
                  return (
                    <ChartTooltipContent
                      // hideLabel // Optionally hide default label if rendering time manually
                      hideIndicator // Hide the default colored squares
                      // Add custom styling via className if needed
                      className="w-auto min-w-[180px] p-2.5"
                    >
                      {/* Build the tooltip content structure */}
                      <div className="space-y-1 text-sm">
                        {' '}
                        {/* Ensure text size consistency */}
                        <p className="font-medium mb-1.5 text-center">
                          {/* Use the 'label' passed by Tooltip (which is the 'time') */}
                          Time: {label}
                          {/* Or access directly from pointData: Time: {pointData.time} */}
                        </p>
                        <p>
                          Median: {formatValue(pointData.median)} {units}
                        </p>
                        <p>
                          Average: {formatValue(pointData.mean)} {units}
                        </p>
                        <p>
                          25th-75th: [{formatValue(pointData.p25)} - {formatValue(pointData.p75)}] {units}
                        </p>
                        <p>
                          10th-90th: [{formatValue(pointData.p10)} - {formatValue(pointData.p90)}] {units}
                        </p>
                      </div>
                    </ChartTooltipContent>
                  );
                }

                // Return null if the tooltip shouldn't be displayed
                return null;
              }}
            />

            {/* --- Percentile Band Definitions --- */}
            {/* Draw order matters: Draw wider/lighter bands first, then narrower/darker on top. */}
            {/* We use two <Area> components per band with the same `stackId`. */}
            {/* The first Area defines the upper bound with a fill. */}
            {/* The second Area defines the lower bound with a transparent fill, effectively masking below it. */}

            {/* Band 1: 10th to 90th Percentile (Lighter fill) */}
            <Area
              dataKey="p90" // Upper bound of the band
              type="monotone" // Smooth curve
              fill={chartConfig.band_10_90.color} // Color from config
              fillOpacity={0.3} // Make it semi-transparent
              stroke="none" // No border line for the area fill
              stackId="band_10_90" // Unique ID for this band's stack calculation
              connectNulls={true} // Draw across gaps where data might be null
              isAnimationActive={false} // Optional: disable animation for faster render
            />
            <Area
              dataKey="p10" // Lower bound of the band
              type="monotone"
              // Fill with transparent (or ideally chart background color) to mask area below p10
              fill="transparent"
              stroke="none"
              stackId="band_10_90" // Must match the stackId of the upper bound (p90)
              connectNulls={true}
              isAnimationActive={false}
            />

            {/* Band 2: 25th to 75th Percentile (Darker fill, drawn on top of 10-90 band) */}
            <Area
              dataKey="p75" // Upper bound
              type="monotone"
              fill={chartConfig.band_25_75.color} // Color from config
              fillOpacity={0.4} // Make it slightly more opaque than the outer band
              stroke="none"
              stackId="band_25_75" // Unique ID for this band
              connectNulls={true}
              isAnimationActive={false}
            />
            <Area
              dataKey="p25" // Lower bound
              type="monotone"
              fill="transparent" // Mask area below p25
              stroke="none"
              stackId="band_25_75" // Match the stackId of the upper bound (p75)
              connectNulls={true}
              isAnimationActive={false}
            />

            {/* --- Median Line --- */}
            {/* Drawn last to appear on top of all area fills */}
            <Line
              dataKey="median" // Data key for the median values
              type="monotone" // Smooth curve
              stroke={chartConfig.median.color} // Color from config
              strokeWidth={2} // Make the line clearly visible
              dot={false} // Hide individual points on the line for a cleaner look
              connectNulls={true} // Draw line across gaps where data might be null
              isAnimationActive={false} // Optional: disable animation
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
