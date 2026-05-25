# {{Cluster Chart Midnight Fix}} — `todo.md`

## TL;DR

Update `ClusterEventsChart.tsx` to dynamically detect midnight-crossing clusters (e.g., 11 PM to 2 AM) and shift the chart's time window to display them continuously without wrapping around the screen edges.

## Invariants (do not change)

1.  **Component API**: `ClusterEventsChart` props (`cluster`, `units`, `treatments`) must remain unchanged.
2.  **Visualization Library**: Must continue using `echarts-for-react`.
3.  **Data Sync**: Glucose (Line) and Carbs (Bar) must remain perfectly synchronized on the vertical time axis.
4.  **Tooltip Data**: Tooltips must display the _original_ correct date/time (e.g., "Mon, Oct 27 01:30"), even if the X-axis plotting position is manipulated.
5.  **UTC Normalization**: The chart currently normalizes time to `2000-01-01` (UTC). This logic must be preserved (shifted to `2000-01-02` where necessary) to maintain compatibility with existing ECharts configurations.

## Assumptions & Scope

- **Assumption**: A "Cluster" typically contains events occurring around the same time of day.
- **Assumption**: The "Boundary Hour" (the cut point for the chart) should be in the middle of the longest period of inactivity (the largest gap) within the cluster's 24-hour cycle.
- **Scope**: Strictly limited to `frontend/src/components/journal/charts/ClusterEventsChart.tsx`.

## Objectives

1.  **Eliminate Wraparound**: Clusters spanning midnight (e.g., 23:00–02:00) must plot continuously, with 23:00 on the left and 02:00 on the right.
2.  **Smart Windowing**: Automatically detect the best 24-hour window (e.g., Noon-to-Noon) based on the data distribution.
3.  **Visual Alignment**: Ensure Carb bars follow the exact same time-shift logic as Glucose lines.

## Risks & Mitigations

- **Risk**: An empty cluster causes calculation errors (e.g., infinite gap).
  - **Mitigation**: Default to standard 00:00 boundary if 0 events exist.
- **Risk**: Performance impact of sorting/analyzing points on every render.
  - **Mitigation**: Use `useMemo` for the boundary calculation. The data size (<1000 points) is negligible for modern browsers.
- **Risk**: "Backwards Line" glitch if an event crosses the chosen boundary.
  - **Mitigation**: The boundary is mathematically guaranteed to be in the _middle_ of the largest gap, ensuring no data points exist there to cross it.

## Method Outline (Gap Analysis)

1.  **Extract & Sort**: Collect every data point's timestamp (converted to minutes-from-midnight, 0–1439).
2.  **Find Largest Gap**: Calculate the time difference between consecutive points. Include the "wraparound gap" (time between the last point of the day and the first point of the next).
3.  **Determine Boundary**:
    - If the Wraparound Gap (23:59 $\to$ 00:00) is the largest, use **0** (Standard Midnight Boundary).
    - Otherwise, use **Midpoint of Largest Gap** (e.g., if largest gap is 04:00–16:00, boundary is 10:00).
4.  **Normalize**: Update `normalizeTime` to shift "early" hours (less than boundary) to the _next_ day (Jan 2), effectively rotating the chart.

## Implementation Notes

- **`getBoundaryHour` Helper**:
  ```typescript
  // Conceptual logic
  function getBoundaryHour(events) {
    if (!events.length) return 0;
    // 1. Get all minutes [0...1440]
    // 2. Sort
    // 3. Find max gap (considering 1440 wraparound)
    // 4. Return midpoint of max gap (floor)
  }
  ```
- **Memoization**:
  ```typescript
  const boundaryHour = useMemo(
    () => getBoundaryHour(cluster.events),
    [cluster.events],
  );
  ```
- **Updated Normalization**:

  ```typescript
  const normalizeTime = (isoString: string, boundaryHour: number) => {
    const d = new Date(isoString);
    const h = d.getUTCHours();
    d.setUTCFullYear(2000);
    d.setUTCMonth(0);

    // If the hour is smaller than our start boundary, it belongs to the "next" logical day
    if (h < boundaryHour) {
      d.setUTCDate(2);
    } else {
      d.setUTCDate(1);
    }
    return d.getTime();
  };
  ```

## Acceptance Gates

- [ ] **Standard Clusters**: A cluster at 2 PM plots normally (Boundary 0).
- [ ] **Midnight Clusters**: A cluster spanning 11 PM $\to$ 1 AM plots continuously (e.g., Boundary ~12:00).
- [ ] **Carb Alignment**: Bar chart bars appear directly under their corresponding glucose events, even when shifted.
- [ ] **Axis Labels**: The X-axis correctly shows time progression (e.g., 22:00, 23:00, 00:00, 01:00).

## “Make-sure-you” Checklist

- [ ] Use `getUTCHours()` and `getUTCMinutes()` for all gap calculations to match `normalizeTime`.
- [ ] Handle the empty cluster case (return 0).
- [ ] Pass `boundaryHour` to the normalization of **both** `lineSeries` (Glucose) and `barSeries` (Carbs).
- [ ] Ensure `boundaryHour` is an integer (0-23) for simplicity in comparison.

## Project hygiene prep

- **Branch**: `fix/midnight-chart-wrap`
- **Issue**: Create GitHub issue "Fix ClusterEventsChart wraparound for midnight hotspots".

## In-depth test plan

Since this is a visual component change, verification will be primarily manual or snapshot-based, but the logic is deterministic.

1.  **Unit Test Logic (Mental Check)**:
    - _Input_: Events at `23:30` and `00:30`.
    - _Gap 1_: `00:30` to `23:30` = 23 hours. (Midpoint: ~12:00).
    - _Gap 2_: `23:30` to `00:30` = 1 hour.
    - _Winner_: Gap 1. Boundary = 12.
    - _Shift_: `23:30` (>=12) $\to$ Jan 1. `00:30` (<12) $\to$ Jan 2.
    - _Order_: Jan 1 23:30 $\to$ Jan 2 00:30. **Correct**.

## In-depth engineering plan

1.  **Define Helper**: Add `getBoundaryHour` function at the bottom of the file (or outside the component).
2.  **Implement Gap Logic**:
    - Flatten all event readings into a sorted array of `minutesFromMidnight`.
    - Iterate to find the max gap.
    - Don't forget the circular gap (`1440 - last + first`).
3.  **Update Component State**: Add `boundaryHour` via `useMemo`.
4.  **Refactor `normalizeTime`**: Update it to accept the `boundaryHour` argument.
5.  **Apply**: Update both `lineSeries` and `barSeries` maps to call `normalizeTime(timestamp, boundaryHour)`.
