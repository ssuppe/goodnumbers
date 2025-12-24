# {{VOYAGER_CLUSTER_VISUALIZATION}} — `todo.md`

## TL;DR
Implement the frontend visualization for Glycemic Clusters on the Journal Page by adapting the `ClusterEventsChart` component to use the existing `echarts` infrastructure and connecting it to the `clusterDataJson` from the API.

## Invariants (do not change)

*   **Data Source:** The visualization must rely *solely* on the `clusterDataJson` stored in the `GlycemicEventCluster` model. No live fetching from Nightscout on the client.
*   **Privacy:** No PHI (glucose values) should be logged to the console during rendering.
*   **Tech Stack:** Use `echarts-for-react` with modular imports (`echarts/core`), matching `AgpChart.tsx` patterns.
*   **Styling:** Use `CHART_THEME` from `frontend/src/lib/chartTheme` for consistency (colors, fonts).

## Assumptions & Scope

*   **Assumption:** The `clusterDataJson` field in the database contains a valid `GlycemicCluster` object with a populated `events` array.
*   **Scope:**
    *   Creating `frontend/src/components/journal/charts/ClusterEventsChart.tsx`.
    *   Updating `frontend/src/components/journal/EventClusterCard.tsx` to render the chart.
*   **Out of Scope:** "Insights" text generation (placeholder only).

## Objectives

1.  **Component Implementation:** Create `ClusterEventsChart` using modular ECharts imports and the shared theme.
2.  **Data Transformation:** Implement logic to normalize event timestamps to a shared 24-hour axis for overlay plotting.
3.  **Integration:** Render the chart inside `EventClusterCard`.
4.  **Verification:** Verify multi-line plotting of cluster events.

## Risks & Mitigations

*   **Risk:** **Bundle Size.** Importing full ECharts is heavy.
    *   **Mitigation:** Use `echarts/core` and register only `LineChart`, `GridComponent`, `TooltipComponent`, etc., as done in `AgpChart.tsx`.
*   **Risk:** **Date Parsing.** Different browsers handle date strings differently.
    *   **Mitigation:** Use standard `Date` parsing or a lightweight utility, ensuring the backend sends ISO strings.

## Method Outline

### 1. Dependencies
*   `npm install echarts echarts-for-react -w frontend`

### 2. Component: `ClusterEventsChart`
*   **Location:** `frontend/src/components/journal/charts/ClusterEventsChart.tsx`
*   **Logic:**
    *   Accept `cluster: GlycemicCluster` and `units: GlucoseUnit` as props.
    *   **Data Prep:** Flatten `cluster.events` into a series of lines. Each event in the cluster becomes a "series" in ECharts.
    *   **Normalization:** Map all timestamps to a generic 24-hour window (e.g., 2000-01-01) for the X-axis.
    *   **Visuals:** Use the design system colors (Primary Blue for lines, Red/Green for thresholds).

### 3. Component: `EventClusterCard` Update
*   **Location:** `frontend/src/components/journal/EventClusterCard.tsx`
*   **Change:**
    *   Parse `cluster.clusterDataJson` (if it's a string/unknown) into a `GlycemicCluster` object.
    *   Pass this object to `<ClusterEventsChart />`.
    *   Handle loading/empty states.

## Implementation Notes & Code Specs

### 1. `frontend/src/components/journal/charts/ClusterEventsChart.tsx`

```typescript
import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CHART_THEME } from '../../../lib/chartTheme';
import { getClinicalThresholds, type GlucoseUnit } from '../../../lib/agpUtils';
import type { GlycemicCluster } from '@goodnumbers/types';

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
const normalizeTime = (isoString: string) => {
  const d = new Date(isoString);
  d.setFullYear(2000, 0, 1);
  return d.getTime();
};

export function ClusterEventsChart({ cluster, units }: ClusterEventsChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize observer logic (same as AgpChart)
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
      type: 'line',
      showSymbol: false,
      smooth: true,
      lineStyle: {
        width: 2,
        opacity: 0.6, // Semi-transparent to show overlap
        color: CHART_THEME.medianLine, // Use theme color
      },
      data: event.readings.map((r) => [
        normalizeTime(r.timestamp),
        r.value,
      ]),
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
           // Custom formatter to show time and values
           // ... implementation details ...
        }
      },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: '{HH}:{mm}', // Show only time
        },
        // Force range to cover full 24h if needed, or auto-scale to cluster window
      },
      yAxis: {
        type: 'value',
        min: (value: { min: number }) => Math.floor(value.min * 0.9),
        max: (value: { max: number }) => Math.ceil(value.max * 1.1),
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
      },
      series: [
        ...series,
        // Threshold lines
        {
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              { yAxis: thresholds.high, lineStyle: { color: CHART_THEME.clinicalHigh } },
              { yAxis: thresholds.low, lineStyle: { color: CHART_THEME.clinicalLow } },
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
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
```

### 2. `frontend/src/components/journal/EventClusterCard.tsx`

```typescript
import { GlycemicEventCluster, GlycemicCluster } from '@goodnumbers/types';
import { ClusterEventsChart } from './charts/ClusterEventsChart';

interface EventClusterCardProps {
  cluster: GlycemicEventCluster;
  // ... other props
}

export default function EventClusterCard({ cluster }: EventClusterCardProps) {
  // Safe parsing of the JSON blob
  const clusterData = useMemo(() => {
    if (typeof cluster.clusterDataJson === 'object') {
      return cluster.clusterDataJson as unknown as GlycemicCluster;
    }
    return null;
  }, [cluster.clusterDataJson]);

  return (
    <Card>
      {/* ... header ... */}
      <div className="p-4">
        {clusterData && (
           <ClusterEventsChart cluster={clusterData} units="MGDL" /> // TODO: Get units from context
        )}
      </div>
      {/* ... notes area ... */}
    </Card>
  );
}
```

## Acceptance Gates

1.  **Visual:** A cluster with 3 events shows 3 distinct lines on the chart.
2.  **Data:** Hovering a point shows the correct glucose value and time.
3.  **Resilience:** If `clusterDataJson` is empty/invalid, show a graceful "No chart data" message instead of crashing.

## "Make-sure-you" Checklist

- [ ] Did you install `echarts` in the frontend workspace?
- [ ] Did you use modular imports for ECharts?
- [ ] Did you use `CHART_THEME` variables?
- [ ] Did you implement the time normalization logic?
- [ ] Did you handle the `units` prop correctly for axis scaling?
