# Goodnumbers — Phase 6, Task 2: High-Fidelity AGP Chart Implementation

## TL;DR

Replace the low-fidelity AGP data placeholder with a production-ready, high-fidelity visualization using Apache ECharts, wrapped in a unified analysis card that displays insights contextually, handles unit conversion (mg/dL vs mmol/L), and supports mobile responsiveness.

## Invariants (do not change)

- **Library:** Must use `echarts` and `echarts-for-react` for the visualization.
- **Visuals:** Must implement the "percentile bands" visualization (5th-95th and 25th-75th shaded areas) exactly as demonstrated in the proof-of-concept.
- **Icons:** Must use `lucide-react` for all icons to match the project standard.
- **Theming:** Chart colors must be defined in a dedicated `chartTheme.ts` file, mapping the application's CSS variables to hex codes. Hardcoded hex values in components are forbidden.
- **Performance:** Chart option generation logic must be wrapped in `useMemo`.
- **Data Integrity:** The backend data is immutable; all unit conversions (e.g., mg/dL to mmol/L) must happen in the frontend transformation layer at render time.

## Assumptions & Scope

- **Assumption:** The `agpChartData` stored in the database is always in `mg/dL`. Conversion logic will handle the user's preferred unit preference.
- **Scope:**
  - Installing visualization dependencies.
  - Creating the theme configuration.
  - Implementing data transformation utilities for unit conversion and normalization.
  - Implementing the `AgpChart` component with responsive resizing.
  - Creating a new `ChartAnalysisCard` component.
  - Integrating these components into the `JournalPage`.
- **Out of Scope:** Changing backend data generation or database schema.

## Objectives

1.  **Dependencies:** Successfully install `echarts` and `echarts-for-react`.
2.  **Theming:** Centralize chart colors in `frontend/src/lib/chartTheme.ts`.
3.  **Utilities:** Implement robust unit conversion and data normalization logic in `frontend/src/lib/agpUtils.ts`.
4.  **Component (Chart):** Implement `AgpChart.tsx` with full feature parity to the PoC (bands, median/mean lines, dynamic clinical thresholds based on units).
5.  **Component (Card):** Implement `ChartAnalysisCard.tsx` to unify the chart and insights.
6.  **Integration:** Replace the placeholder in `JournalPage` with the high-fidelity implementation.

## Risks & Mitigations

- **Risk:** **Unit Mismatch.** The chart might display mg/dL values while the axis says mmol/L if conversion logic is flawed.
  - **Mitigation:** The `agpUtils.test.ts` suite will strictly verify conversion math. The chart component will require `units` as a prop and use it to derive both axis labels and threshold lines from the utility functions.
- **Risk:** **Mobile Layout.** Canvas charts often fail to resize when the parent container shrinks.
  - **Mitigation:** The `AgpChart` component will implement a `ResizeObserver` on its container to programmatically trigger `chartInstance.resize()`.
- **Risk:** **Bundle Size.** ECharts is large.
  - **Mitigation:** We accept the full bundle size for MVP velocity but will ensure the import is isolated to the chart component, allowing for future lazy-loading optimization.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Adapt the PoC ECharts configuration but decouple the data logic from the rendering logic using a transformation utility layer.
- **Mechanism:**
  1.  **Theme Extraction:** Define color constants once.
  2.  **Transformation Layer:** Create a pure function `normalizeAgpData` that takes raw API data and the user's unit preference, returning a standardized structure ready for ECharts.
  3.  **Smart/Dumb Split:** `JournalPage` (Smart) fetches data -\> `ChartAnalysisCard` (Dumb) receives data -\> `AgpChart` (Dumb) renders it.
- **Trade-offs:** Adding a transformation layer adds code, but it ensures the chart component remains purely presentational and unit-agnostic.
- **Go/No-Go:** **Go**.

## Implementation Notes

- **File Paths:**
  - `frontend/src/lib/chartTheme.ts`
  - `frontend/src/lib/agpUtils.ts`
  - `frontend/src/components/journal/charts/AgpChart.tsx`
  - `frontend/src/components/journal/ChartAnalysisCard.tsx`
- **Dependencies:** `npm install echarts echarts-for-react -w frontend`
- **Unit Conversions:** 1 mmol/L = 18.0182 mg/dL.
- **Clinical Thresholds:**
  - mg/dL: Low \< 70, High \> 180.
  - mmol/L: Low \< 3.9, High \> 10.0.

## Acceptance Gates

1.  `npm test -w frontend` passes with 100% coverage for the new utility functions.
2.  The `JournalPage` displays the AGP chart.
3.  If the user's preferred unit is `MMOL`, the chart axes and tooltips display values in mmol/L (e.g., median \~6.5, not 117).
4.  Hovering over the chart highlights the specific time slot and dims others (Spotlight effect).
5.  Resizing the browser window automatically resizes the chart canvas without a reload.

## “Make-sure-you” Checklist

- [ ] Did you install `echarts` and `echarts-for-react`?
- [ ] Did you implement `normalizeAgpData` to handle potential `null` values in the raw data?
- [ ] Does `getClinicalThresholds` return different values based on the `units` argument?
- [ ] Did you use `useMemo` for the ECharts `option` object?
- [ ] Did you attach a `ResizeObserver` to the chart container?

## Project hygiene prep

1.  **Create Issue:**
    ```bash
    gh issue create --title "feat(ui): P6_T2 Implement High-Fidelity AGP Chart" --body "Port the AGP Chart from PoC using ECharts, implement unit conversion utils, create a unified analysis card, and integrate into the Journal View."
    ```
2.  **Create Branch:**
    ```bash
    git checkout phase6develop
    git pull origin phase6develop
    git checkout -b feat/phase6-task2-agp-chart
    ```

## In-depth test plan

### 1\. Unit Test: `frontend/src/lib/agpUtils.test.ts`

- **Goal:** Verify data transformation and unit logic.
- **Test Cases:**
  - `getClinicalThresholds`: Returns `{ low: 70, high: 180 }` for 'MGDL' and `{ low: 3.9, high: 10.0 }` for 'MMOL'.
  - `normalizeAgpData`:
    - Takes raw mock data (mg/dL) and converts it to mmol/L if requested (divides by 18.0182).
    - Handles `null` values gracefully (preserves them as `null`).
    - Formats time strings if necessary.

### 2\. Component Test: `frontend/src/components/journal/charts/AgpChart.test.tsx`

- **Goal:** Verify the chart component renders without crashing and accepts options.
- **Method:** Mock `echarts-for-react`.
- **Test Cases:**
  - Renders with valid data.
  - Passes an `option` object to the ECharts instance containing `xAxis`, `yAxis`, and `series`.
  - The `yAxis.name` matches the provided `units` prop.

### 3\. Component Test: `frontend/src/components/journal/ChartAnalysisCard.test.tsx`

- **Goal:** Verify layout and insight rendering.
- **Test Cases:**
  - Renders the title.
  - Renders the chart component (mocked).
  - Renders the list of insights with correct icons based on priority (e.g., Critical = AlertCircle).

## In-depth engineering plan

### Step 1: Install Dependencies

```bash
npm install echarts echarts-for-react -w frontend
```

### Step 2: Define Chart Theme

Create `frontend/src/lib/chartTheme.ts`.

```typescript
export const CHART_THEME = {
  medianLine: "#1976d2", // Matches var(--primary-color)
  meanLine: "rgba(70, 90, 130, 0.8)",
  clinicalLow: "#d32f2f", // Matches var(--feedback-critical-color)
  clinicalHigh: "#d32f2f",
  patientGoal: "#52c41a",
  bands: {
    outer: "rgba(120, 140, 180, 0.25)", // 5th-95th
    inner: "rgba(90, 110, 150, 0.35)", // 25th-75th
  },
};
```

### Step 3: Implement Utilities (TDD)

1.  **Red:** Create `frontend/src/lib/agpUtils.test.ts` with the test cases defined above.
2.  **Green:** Create `frontend/src/lib/agpUtils.ts`.
    - Implement `convertGlucose(value: number, toUnits: GlucoseUnit)`.
    - Implement `getClinicalThresholds(units: GlucoseUnit)`.
    - Implement `normalizeAgpData(data: any[], units: GlucoseUnit)`.

### Step 4: Implement `AgpChart` (TDD)

1.  **Red:** Create `frontend/src/components/journal/charts/AgpChart.test.tsx`.
2.  **Green:** Create `frontend/src/components/journal/charts/AgpChart.tsx`.
    - Copy the `renderItem` logic from the PoC for the custom polygon bands.
    - Replace hardcoded colors with `CHART_THEME`.
    - Use `getClinicalThresholds` for the static lines.
    - Implement `useMemo` for the `option` object.
    - **Crucial:** Add `useEffect` with `ResizeObserver` to handle mobile responsiveness:
      ```typescript
      useEffect(() => {
        const handleResize = () => chartInstance?.resize();
        window.addEventListener("resize", handleResize); // Fallback
        // ... implementation of ResizeObserver on container ref
      }, []);
      ```

### Step 5: Implement `ChartAnalysisCard` (TDD)

1.  **Red:** Create `frontend/src/components/journal/ChartAnalysisCard.test.tsx`.
2.  **Green:** Create `frontend/src/components/journal/ChartAnalysisCard.tsx`.
    - Import `AgpChart`.
    - Accept `insights` prop.
    - Map insights to `lucide-react` icons (`AlertCircle`, `AlertTriangle`, `Info`, `Lightbulb`).
    - Render layout: Title -\> Chart -\> Insights List.

### Step 6: Integration

1.  Open `frontend/src/pages/JournalPage.tsx`.
2.  Import `ChartAnalysisCard` and `normalizeAgpData`.
3.  Inside the component, use `useMemo` to transform the raw `journal.agpChartData` using `normalizeAgpData` and the user's `preferredUnits` (from AuthContext).
4.  Replace the placeholder `<AGPChart />` with the new `<ChartAnalysisCard />`, passing the transformed data.

### Step 7: Verification

1.  Run `npm test -w frontend`.
2.  Manual Check:
    - Log in.
    - Go to Account Setup -\> Change units to "mmol/L".
    - Go to Journal View.
    - Verify chart axes are \< 20 (mmol scale) and not \> 300 (mg/dl scale).
    - Resize window -\> Chart should adapt.
