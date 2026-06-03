# Event Cluster Card: Component Specification

**Version:** 2.0 (Reconciled with ECharts Implementation)
**Status:** High-Fidelity Implementation Verified

## 1. Executive Summary

The Event Cluster Card is a modular, high-fidelity UI component designed to visualize recurring blood glucose patterns (e.g., post-meal spikes, dawn phenomenon). It combines complex multi-plot charting, traveler-aware localization, and progressively disclosed AI insights into a single vertical stack.

## 2. UX Design Specifications

### 2.1 Visual Hierarchy

The card follows a dense, integrated vertical rhythm:
1.  **Header (Context)**: Dynamic title utilizing colloquial terms ("High blood sugar events"). If the journal spans multiple offsets, a human-friendly city name and GMT offset (e.g., "London / Paris (GMT+1)") is appended.
2.  **Visualization (Evidence)**: An interactive **Apache ECharts** multi-grid visualization.
    *   **Top Grid (50%)**: Glucose timeseries with color-coded day groups.
    *   **Bottom Grids (18% each)**: Perfectly aligned bar charts for Insulin and Carbs.
3.  **Analysis (Insight)**: Progressive disclosure toggle revealing AI clinical reasoning.
4.  **Action (Notes)**: Direct input field for user reflection, enhanced by AI-suggested "Quick Log" chips.

### 2.2 Visualization Strategy (ECharts)

*   **Renderer**: **Canvas Engine**. Selected for stability during complex gradient calculations and window resizing.
*   **Coordinate Safety**: Strictly non-overlapping `visualMap` pieces with explicit gap-filling to prevent internal coordinate lookup failures.
*   **High-Fidelity Scanning**: A frontend scanner marks every reading above/below clinical thresholds as "solid/opaque", ensuring critical excursions are always visible.
*   **Vertical Alignment**: All Y-axes are mathematically aligned at a fixed `left: 90` margin by disabling `containLabel` and synchronizing `nameGap`.

### 2.3 Color System

We use a semantic palette defined in `chartTheme.ts`:
*   **Day Colors**: A rotating sequence of 8 recognizable colors (Blues, Purples, Emeralds) to distinguish multiple days on the same plot.
*   **Highlight Opacity**:
    *   **Solid**: Applied to out-of-bounds peaks and behavioral event windows.
    *   **Faded (20% Opacity)**: Applied to "in-range" segments to reduce visual noise.

## 3. Data Structure & Metadata

The component extracts metadata from the `clusterDataJson` blob:
*   **Timezone**: IANA name (e.g. `Europe/London`).
*   **utcOffset**: Current offset in minutes.
*   **Events**: Array of `GlycemicEvent` with raw readings for high-resolution plotting.

## 4. Implementation Notes for Engineers

*   **Performance**: The chart uses `useMemo` for option generation, keyed to data and units. Resize observation is handled via a dedicated `useEffect` and `ResizeObserver`.
*   **Stability**: All timestamps and values MUST be shielded by `isNaN` checks before reaching the series data.
*   **Linking**: Interactive highlighting is synchronized across all grids using identical `seriesName` values and linked `axisPointer` indices.
