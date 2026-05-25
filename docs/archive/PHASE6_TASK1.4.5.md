# {{Goodnumbers}} — `fix-cluster-chart-scaling.md`

## TL;DR

Synchronize the x-axis (time) scaling between the glucose line chart and carbs bar chart in `ClusterEventsChart.tsx` by calculating a unified time domain and explicitly setting `min`/`max` on both axes.

## Invariants (do not change)

1.  **Library**: Must continue using `echarts-for-react` and `echarts`.
2.  **Normalization**: Time normalization logic (`normalizeTime`, `boundaryHour`) must remain as the source of truth for x-axis positioning.
3.  **Visuals**: The top chart (glucose) and bottom chart (carbs) must remain vertically stacked.
4.  **Interaction**: Existing hover/highlight interactions must be preserved.

## Assumptions & Scope

- **Assumption**: The "misalignment" is caused by ECharts auto-scaling the two x-axes independently based on their respective data ranges.
- **Scope**:
  - Modify `frontend/src/components/journal/charts/ClusterEventsChart.tsx`.
  - Extract domain calculation logic to a testable utility in `chartUtils.ts`.
  - No changes to backend or data fetching.

## Objectives

1.  **Visual Alignment**: Ensure vertical alignment of time points between the top and bottom charts.
2.  **Data Visibility**: Ensure the x-axis range covers the full extent of both glucose readings and carb treatments, plus a readable buffer.
3.  **UX Improvement**: Synchronize the axis pointer (hover line) across both charts.
4.  **Testability**: Verify the domain calculation logic with unit tests.

## Risks & Mitigations

- **Risk**: Outliers in data (e.g., a carb entry 12 hours away) could compress the main cluster view.
  - **Mitigation**: The existing `barSeries` generation logic already filters treatments to a buffer window (`bufferMinutes = 60`) around the event. This inherently limits outliers.
- **Risk**: Empty datasets causing `Math.min/max` errors (`Infinity`).
  - **Mitigation**: Implement robust checks for empty data arrays before calculating domains, defaulting to a standard range if needed.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Force both x-axes to share the exact same `min` and `max` values.
- **Mechanism**:
  1.  Generate `lineSeries` and `barSeries` data first.
  2.  Iterate through all data points in both series to find the global `minTime` and `maxTime`.
  3.  Apply a fixed buffer (e.g., 30 minutes) to the start and end.
  4.  Pass these values to the `min` and `max` properties of both `xAxis` objects in the ECharts option.
  5.  Enable `axisPointer: { link: { xAxisIndex: 'all' } }`.
- **Trade-offs**: Slightly more computation during render (iterating data points), but negligible for the data size (< 1000 points).
- **Go/No-Go**: **Go**.

## Implementation Notes

- **Buffer**: Add 30 minutes (`30 * 60 * 1000` ms) padding to both sides of the domain to ensure points aren't cut off at the edges.
- **Axis Pointer**: Add `axisPointer: { link: { xAxisIndex: 'all' }, label: { backgroundColor: '#777' } }` to the top-level option to sync the hover guide.
- **Data Access**: Access the normalized time at `datum.value[0]`.
- **Type Safety**: Ensure strict typing when extracting values from the `series` objects.

## Acceptance Gates

- [ ] **Visual**: The x-axis labels on the bottom chart align perfectly with the time points on the top chart.
- [ ] **Range**: The chart shows all data points; no points are clipped.
- [ ] **Interaction**: Hovering on the top chart shows the vertical guide line extending through the bottom chart.
- [ ] **Tests**: Unit tests for domain calculation pass.

## “Make-sure-you” Checklist

- [ ] Handle the case where `barSeries` is empty (only glucose data).
- [ ] Ensure `min` and `max` are numbers (timestamps), not Date objects.
- [ ] Verify that `boundaryHour` logic doesn't interfere (it shouldn't, as we use the post-normalized values).
- [ ] Check console for any ECharts warnings about axis range.

## Project hygiene prep

- **Branch**: `fix/cluster-chart-scaling`
- **Issue**: Create GitHub issue "Fix ClusterEventsChart x-axis scaling mismatch".
- **Test Command**: `npm test -w frontend`

## In-depth test plan

### 1. Unit Test: Domain Calculation Logic

**File**: `frontend/src/components/journal/charts/__tests__/chartUtils.test.ts`

- **Goal**: Verify that the domain calculation correctly identifies the union of ranges.
- **Test Cases**:
  - **Disjoint Ranges**:
    - Input: Series A [100, 200], Series B [300, 400].
    - Expected: Min 100, Max 400 (before padding).
  - **Overlapping Ranges**:
    - Input: Series A [100, 300], Series B [200, 400].
    - Expected: Min 100, Max 400.
  - **Subset Ranges**:
    - Input: Series A [100, 400], Series B [200, 300].
    - Expected: Min 100, Max 400.
  - **Single Series**:
    - Input: Series A [100, 200], Series B [].
    - Expected: Min 100, Max 200.
  - **Padding**: Verify the function adds the requested padding.

### 2. Manual Verification (Metamorphic)

- **Scenario**: Load a cluster with glucose events at 14:00 and a carb entry at 13:30.
- **Check**: The chart start time should be <= 13:30 (minus padding).
- **Check**: The vertical alignment of the 14:00 glucose point and the 14:00 tick mark on the bottom axis must be exact.

## In-depth engineering plan

### Step 1: Red (Write the Test First)

1.  Create `frontend/src/components/journal/charts/__tests__/chartUtils.test.ts`.
2.  Add tests for a function named `calculateCommonDomain` (which doesn't exist yet).

    ```typescript
    import { describe, it, expect } from "vitest";
    // @ts-ignore
    import { calculateCommonDomain } from "../chartUtils";

    describe("calculateCommonDomain", () => {
      it("calculates domain for disjoint ranges with padding", () => {
        const series = [
          { data: [{ value: [100, 0] }, { value: [200, 0] }] },
          { data: [{ value: [300, 0] }, { value: [400, 0] }] },
        ];
        // 30 mins padding = 1,800,000 ms
        const result = calculateCommonDomain(series, 30);
        expect(result).toEqual({ min: 100 - 1800000, max: 400 + 1800000 });
      });
      // ... other tests
    });
    ```

3.  Run the test: `npm test -w frontend src/components/journal/charts/__tests__/chartUtils.test.ts`.
4.  **Verify Failure**: Confirm the test fails.

### Step 2: Green (Implement Logic)

1.  Open `frontend/src/components/journal/charts/chartUtils.ts`.
2.  Implement `calculateCommonDomain`:

    ```typescript
    export function calculateCommonDomain(
      seriesList: { data: { value: (number | string)[] }[] }[],
      paddingMinutes: number = 30,
    ): { min: number; max: number } | null {
      let min = Infinity;
      let max = -Infinity;
      let hasData = false;

      for (const series of seriesList) {
        if (!series.data) continue;
        for (const item of series.data) {
          const time = item.value[0];
          if (typeof time === "number") {
            if (time < min) min = time;
            if (time > max) max = time;
            hasData = true;
          }
        }
      }

      if (!hasData) return null;

      const padding = paddingMinutes * 60 * 1000;
      return {
        min: min - padding,
        max: max + padding,
      };
    }
    ```

3.  Run the test again.
4.  **Verify Success**: Confirm all tests pass.

### Step 3: Refactor (Integrate into Component)

1.  Open `frontend/src/components/journal/charts/ClusterEventsChart.tsx`.
2.  Import `calculateCommonDomain` from `./chartUtils`.
3.  Inside the `options` useMemo:
    - After `lineSeries` and `barSeries` are defined, combine them:
      ```typescript
      const allSeries = [...lineSeries, ...barSeries];
      const domain = calculateCommonDomain(allSeries as any);
      ```
4.  Update the `xAxis` configuration:
    - Apply `min` and `max` to **both** axes in the `xAxis` array if `domain` exists.
      ```typescript
      const xAxisCommon = {
        min: domain ? domain.min : undefined,
        max: domain ? domain.max : undefined,
      };
      ```
    - Ensure `gridIndex: 0` gets these props, and `gridIndex: 1` gets these props.
5.  Add axis pointer linking to the return object:
    ```typescript
    return {
      axisPointer: {
        link: { xAxisIndex: "all" },
        label: { backgroundColor: "#777" },
      },
      // ... existing options
    };
    ```
