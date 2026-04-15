# {{VOYAGER_CLUSTER_VISUALIZATION}} — `todo.md`

## TL;DR

Implement the frontend visualization for Glycemic Clusters using a **Strict TDD** approach. We will write component tests to verify data transformation and rendering logic before implementing the ECharts wrapper and integration.

## Invariants (do not change)

- **TDD First:** All components must be verified by a failing test (Red) before implementation (Green).
- **Data Source:** Visualization relies solely on `clusterDataJson` from the API.
- **Tech Stack:** `echarts-for-react` with modular imports (`echarts/core`).
- **Styling:** Use `CHART_THEME` variables.

## Objectives

1.  **Test Coverage:** Unit tests verifying that `GlycemicCluster` data is correctly transformed into ECharts series.
2.  **Component Implementation:** `ClusterEventsChart` with time normalization.
3.  **Integration:** `EventClusterCard` rendering the chart safely.

## Method Outline (TDD Cycles)

### Cycle 1: Chart Data Transformation

- **Goal:** Verify that the `ClusterEventsChart` component correctly normalizes time and generates one series per event.
- **Red:** Create `frontend/src/components/journal/charts/ClusterEventsChart.test.tsx`.
  - Mock `echarts-for-react` to capture the `option` prop.
  - Pass a mock `GlycemicCluster` with 2 events.
  - **Assert:** The `option.series` array has length 2.
  - **Assert:** The X-axis data points are normalized to the same date (e.g., `2000-01-01`).
- **Green:** Implement `ClusterEventsChart.tsx` with the normalization logic and series mapping (see Reference Implementation below).
- **Refactor:** Ensure strict typing and extract the `normalizeTime` helper.

### Cycle 2: Card Integration & Parsing

- **Goal:** Verify `EventClusterCard` handles the JSON parsing safely.
- **Red:** Create `frontend/src/components/journal/EventClusterCard.test.tsx`.
  - Pass a `GlycemicEventCluster` with a valid JSON string in `clusterDataJson`.
  - **Assert:** The `ClusterEventsChart` is rendered.
  - Pass invalid/null JSON.
  - **Assert:** The chart is NOT rendered (graceful failure).
- **Green:** Update `EventClusterCard.tsx` to parse the JSON and conditionally render the chart (see Reference Implementation below).

## Reference Implementation (Target for Green Phase)

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

## "Make-sure-you" Checklist

- [ ] Did you write the test _before_ the component?
- [ ] Did you mock `echarts-for-react` to verify the options object?
- [ ] Did you verify that time normalization handles midnight wrapping correctly (visually or via data inspection)?
