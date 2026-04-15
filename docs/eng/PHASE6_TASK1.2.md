# Goodnumbers — Phase 6, Task 2: High-Fidelity AGP Chart Implementation — `docs/eng/PHASE6_TASK2.md`

## TL;DR

Replace the low-fidelity AGP data placeholder with a production-ready, high-fidelity visualization using Apache ECharts, wrapped in a unified analysis card that displays insights contextually, handles unit conversion (mg/dL vs mmol/L) safely, and supports mobile responsiveness.

## Invariants (do not change)

- **Library:** Must use `echarts` and `echarts-for-react` for the visualization.
- **Visuals:** Must implement the "percentile bands" visualization (5th-95th and 25th-75th shaded areas) exactly as demonstrated in the proof-of-concept.
- **Icons:** Must use `lucide-react` for all icons to match the project standard.
- **Theming:** Chart colors must be defined in a dedicated `chartTheme.ts` file, mapping the application's CSS variables to hex codes. Hardcoded hex values in components are forbidden.
- **Performance:** Chart option generation logic must be wrapped in `useMemo`.
- **Data Integrity:** The backend data is immutable; all unit conversions (e.g., mg/dL to mmol/L) must happen in the frontend transformation layer at render time.
- **Safety:** Runtime guards must prevent biologically impossible values (e.g., 180 mmol/L) from rendering due to conversion errors.

## Assumptions & Scope

- **Assumption:** The `agpChartData` stored in the database is always in `mg/dL`. Conversion logic will handle the user's preferred unit preference.
- **Scope:**
  - Installing visualization dependencies (pinned versions).
  - Creating the theme configuration.
  - Implementing data transformation utilities for unit conversion, normalization, and PII stripping.
  - Implementing the `AgpChart` component with responsive resizing and error boundaries.
  - Creating a new `ChartAnalysisCard` component.
  - Integrating these components into the `JournalPage`.
- **Out of Scope:** Changing backend data generation or database schema.

## Objectives

1.  **Dependencies:** Successfully install `echarts` (pinned) and `echarts-for-react`.
2.  **Theming:** Centralize chart colors in `frontend/src/lib/chartTheme.ts`.
3.  **Utilities:** Implement robust unit conversion and data normalization logic in `frontend/src/lib/agpUtils.ts` with security stripping.
4.  **Component (Chart):** Implement `AgpChart.tsx` with feature parity to the PoC (bands, median/mean lines, dynamic clinical thresholds based on units).
5.  **Component (Card):** Implement `ChartAnalysisCard.tsx` to unify the chart and insights.
6.  **Integration:** Replace the placeholder in `JournalPage` with the high-fidelity implementation.

## Risks & Mitigations

- **Risk:** **Unit Mismatch/Safety.** The chart might display mg/dL values while the axis says mmol/L if conversion logic is flawed.
  - **Mitigation:** Implement a **Runtime Guard** in `agpUtils.ts`. Values \> 35 mmol/L or \< 10 mg/dL must trigger a warning or return `null`.
- **Risk:** **Data Leakage (PII).** Raw backend data includes serial numbers and notes.
  - **Mitigation:** The `normalizeAgpData` utility function must explicitly **allowlist** only the necessary fields (`time`, `p5`, `p25`, `median`, `mean`, `p75`, `p95`) and discard all other properties before passing data to the component state.
- **Risk:** **Mobile Layout.** Canvas charts often fail to resize when the parent container shrinks.
  - **Mitigation:** The `AgpChart` component will implement a `ResizeObserver` on its container to programmatically trigger `chartInstance.resize()`.
- **Risk:** **Supply Chain.** ECharts configuration injection.
  - **Mitigation:** Pin `echarts` version in `package.json`. Construct options purely from trusted code (no deep merging of user input).

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Adapt the PoC ECharts configuration but decouple the data logic from the rendering logic using a transformation utility layer that also acts as a security sanitizer.
- **Mechanism:**
  1.  **Theme Extraction:** Define color constants once.
  2.  **Transformation Layer:** Create a pure function `normalizeAgpData` that takes raw API data, sanitizes it (removes PII), and converts units based on user preference.
  3.  **Smart/Dumb Split:** `JournalPage` (Smart) fetches data -\> `ChartAnalysisCard` (Dumb) receives data -\> `AgpChart` (Dumb) renders it.
- **Trade-offs:** Adding a transformation layer adds code, but it ensures the chart component remains purely presentational, secure, and unit-agnostic.
- **Go/No-Go:** **Go**.

## Implementation Notes

- **File Paths:**
  - `frontend/src/lib/chartTheme.ts`
  - `frontend/src/lib/agpUtils.ts`
  - `frontend/src/components/journal/charts/AgpChart.tsx`
  - `frontend/src/components/journal/ChartAnalysisCard.tsx`
- **Dependencies:** `npm install echarts@5.5.0 echarts-for-react@3.0.2 -w frontend --save-exact` (Use specific versions vetted for stability).
- **Unit Conversions:** 1 mmol/L = 18.0182 mg/dL.
- **Clinical Thresholds:**
  - mg/dL: Low \< 70, High \> 180.
  - mmol/L: Low \< 3.9, High \> 10.0.
- **Security:**
  - Insight rendering must use React's default text interpolation (no `dangerouslySetInnerHTML`).
  - Wrap `AgpChart` in a standard React Error Boundary.

## Acceptance Gates

1.  `npm test -w frontend` passes with 100% coverage for the new utility functions.
2.  The `JournalPage` displays the AGP chart.
3.  If the user's preferred unit is `MMOL`, the chart axes and tooltips display values in mmol/L (e.g., median \~6.5, not 117).
4.  Data passed to the chart does _not_ contain `pumpSerial`, `identifier`, or `created_at` fields (verified via React DevTools or console log in dev).
5.  Hovering over the chart highlights the specific time slot and dims others (Spotlight effect).
6.  Resizing the browser window automatically resizes the chart canvas without a reload.

## “Make-sure-you” Checklist

- [ ] Did you install `echarts` and `echarts-for-react` with pinned versions?
- [ ] Did you implement `normalizeAgpData` to strip PII fields?
- [ ] Does `getClinicalThresholds` return different values based on the `units` argument?
- [ ] Did you implement the runtime safety guard for glucose values?
- [ ] Did you use `useMemo` for the ECharts `option` object?
- [ ] Did you attach a `ResizeObserver` to the chart container?

## Project hygiene prep

1.  **Create Issue:**
    ```bash
    gh issue create --title "feat(ui): P6_T2 Implement High-Fidelity AGP Chart" --body "Port the AGP Chart from PoC using ECharts, implement unit conversion utils with security sanitization, create a unified analysis card, and integrate into the Journal View."
    ```
2.  **Create Branch:**
    ```bash
    git checkout phase6develop
    git pull origin phase6develop
    git checkout -b feat/phase6-task2-agp-chart
    ```

## In-depth test plan

### 1\. Unit Test: `frontend/src/lib/agpUtils.test.ts`

- **Goal:** Verify data transformation, unit logic, and security/safety guards.
- **Test Cases:**
  - `getClinicalThresholds`: Returns `{ low: 70, high: 180 }` for 'MGDL' and `{ low: 3.9, high: 10.0 }` for 'MMOL'.
  - `normalizeAgpData`:
    - **Unit Conversion:** Takes raw mock data (mg/dL) and converts it to mmol/L (divides by 18.0182).
    - **Safety Guard:** Returns `null` or clamps value if input is 0 or \> 1000 mg/dL.
    - **Sanitization:** Input object with `{ p5: 100, pumpSerial: '123' }` returns object with `{ p5: 5.5 }` (no `pumpSerial`).
    - **Null Handling:** Preserves `null` values correctly.

### 2\. Component Test: `frontend/src/components/journal/charts/AgpChart.test.tsx`

- **Goal:** Verify the chart component renders without crashing and accepts options.
- **Method:** Mock `echarts-for-react`.
- **Test Cases:**
  - Renders with valid data.
  - Passes an `option` object to the ECharts instance containing `xAxis`, `yAxis`, and `series`.
  - The `yAxis.name` matches the provided `units` prop.
  - Does _not_ crash if data array is empty (renders "No data" state).

### 3\. Component Test: `frontend/src/components/journal/ChartAnalysisCard.test.tsx`

- **Goal:** Verify layout and insight rendering.
- **Test Cases:**
  - Renders the title.
  - Renders the chart component (mocked).
  - Renders the list of insights with correct icons based on priority (e.g., Critical = AlertCircle).
  - Verifies insights are text-only (no HTML injection).

## In-depth engineering plan

### Step 1: Install Dependencies

```bash
npm install echarts@5.5.0 echarts-for-react@3.0.2 -w frontend --save-exact
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

1.  **Red:** Create `frontend/src/lib/agpUtils.test.ts` with the test cases defined above (conversion, safety, sanitization).
2.  **Green:** Create `frontend/src/lib/agpUtils.ts`.
    - Implement `convertGlucose(value: number, toUnits: GlucoseUnit)`. Add guard: `if (value < 10 || value > 1000) return null;`.
    - Implement `getClinicalThresholds(units: GlucoseUnit)`.
    - Implement `normalizeAgpData(data: any[], units: GlucoseUnit)`.
      - **Crucial:** Map explicitly: `return { time: item.time, p5: convert(item.p5), ... }`. Do NOT spread `...item`.

### Step 4: Implement `AgpChart` (TDD)

1.  **Red:** Create `frontend/src/components/journal/charts/AgpChart.test.tsx`.
2.  **Green:** Create `frontend/src/components/journal/charts/AgpChart.tsx`.
    - Copy the `renderItem` logic from the PoC for the custom polygon bands.
    - Replace hardcoded colors with `CHART_THEME`.
    - Use `getClinicalThresholds` for the static lines.
    - Implement `useMemo` for the `option` object.
    - Add `useEffect` with `ResizeObserver` to handle mobile responsiveness.
    - Wrap entire return in an Error Boundary (or try/catch block rendering a fallback).

### Step 5: Implement `ChartAnalysisCard` (TDD)

1.  **Red:** Create `frontend/src/components/journal/ChartAnalysisCard.test.tsx`.
2.  **Green:** Create `frontend/src/components/journal/ChartAnalysisCard.tsx`.
    - Import `AgpChart`.
    - Accept `insights` prop.
    - Map insights to `lucide-react` icons (`AlertCircle`, `AlertTriangle`, `Info`, `Lightbulb`).
    - Render layout: Title -\> Chart -\> Insights List.
    - Ensure insights use `{insight.text}` (safe) not `dangerouslySetInnerHTML`.

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
    - Verify via React DevTools that only chart-relevant data is in the component props.
