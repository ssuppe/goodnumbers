Statistical Insights Architecture

1. Core Logic & Location
   The insights engine is a deterministic, rule-based system located in backend/src/lib/insights/:

- `aggregate.ts`: Analyzes the entire week's dataset (GMI, Time in Range, Time Below Range). Implements the "Safety > Stability > Optimization"
  clinical hierarchy.
- `cluster.ts`: Analyzes specific glycemic events (hotspots) to find correlations with treatments (e.g., "Uncovered Meal" detection).

2. Data Flow & Trigger

- Trigger: Executed by the background worker (backend/src/worker.ts) during the processJournalJob routine, immediately after fetching
  Nightscout data and detecting hotspots.
- Input: Takes raw GlucoseEntry[] and normalized Treatment[] arrays.
- Validation: All outputs are rigorously validated via Zod schemas (@goodnumbers/schemas/src/insights.ts) to ensure no HTML/XSS vectors exist
  before database storage.
- Persistence:
  - Aggregate insights $\rightarrow$ Journal.analysisInsights (JSON)
  - Cluster insights $\rightarrow$ GlycemicEventCluster.insights (JSON)

3. Frontend Consumption

- Shared Types: Interfaces (Insight, InsightPriority) are exported from @goodnumbers/types for full-stack type safety.
- Display:
  - `ChartAnalysisCard.tsx`: Renders aggregate insights (GMI warnings, etc.) below the AGP chart.
  - `EventClusterCard.tsx`: Renders cluster-specific insights (e.g., missed bolus warnings) within individual event cards.

4. Key Invariants

- No AI: Logic is pure TypeScript; no LLM calls are involved.
- Security: HTML characters (<, >) are strictly forbidden in insight text.
- Performance: Treatment arrays are pre-sorted in the worker to ensure $O(N)$ efficiency during cluster correlation.
