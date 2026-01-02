The plan explicitly enforces this separation to keep the UI clean and the data logical:

1.  **Aggregate Insights** (Weekly stats, GMI, TIR) $\rightarrow$ Saved to `Journal.analysisInsights` $\rightarrow$ Rendered **ONLY** in the **AGP Chart Card** (`ChartAnalysisCard`).
2.  **Cluster Insights** (Rebound, Meals, Timing) $\rightarrow$ Saved to `GlycemicEventCluster.insights` $\rightarrow$ Rendered **ONLY** in the specific **Event Cluster Cards** (`EventClusterCard`).

Here is the final, frozen design document ready for implementation.

---

# Context File: PHASE6_TASK2.md

# NON_AI_CLINICAL_INSIGHTS_SPEC

**Version:** 2.0 (FINAL)
**Goal:** Implement a deterministic, clinically-informed heuristic engine to generate educational discussion topics, strictly separating **Weekly Aggregate Insights** (for the AGP Chart) from **Specific Cluster Insights** (for Event Cards).

---

## 1. Core Philosophy & Invariants

1.  **Template-Based Safety**: All user-facing text **must** come from a static registry (`templates.ts`). No dynamic string construction of medical advice.
2.  **"Soft" Clinical Tone**: Use observational language ("We noticed," "Consider discussing") rather than imperative commands ("Inject," "Change ratio").
3.  **Determinism**: Identical data must always yield identical insights.
4.  **Performance**: Heuristics must be $O(N)$ relative to the cluster size, avoiding nested loops over the entire treatment history.

---

## 2. Data Structures & Separation

### 2.1. Shared Schemas (`packages/schemas`)

We define two distinct schemas to enforce the separation of concerns.

**A. `AggregateInsight` (For AGP Chart/Weekly View)**

- **Target Field:** `Journal.analysisInsights`
- **Purpose:** High-level context on GMI, TIR, and Hypo risk.
- **UI Location:** `ChartAnalysisCard` (The big chart at the top).

**B. `ClusterInsight` (For Event Cards)**

- **Target Field:** `GlycemicEventCluster.insights`
- **Purpose:** Specific context on Rebounds, Meal timing, Sensor issues.
- **UI Location:** `EventClusterCard` (The individual pattern cards below).

**C. Allowed Icons (Strict Enum)**

- `Activity` (Rebound)
- `Sun` (Dawn/Morning)
- `BedDouble` (Sleep/Compression)
- `Utensils` (Meal/Food)
- `Clock` (Timing)
- `TrendingUp` (Highs)
- `TrendingDown` (Lows)
- `AlertTriangle` (Risk)
- `CheckCircle` (Good News)
- `Info` (General)

---

## 3. Implementation Plan (TDD Workflow)

Follow the **Red-Green-Refactor** cycles strictly. Stop if a test fails.

### Phase 1: Shared Schemas & Types

**Goal:** Define the contract.

#### Cycle 1.1: Define Schemas

1.  **RED (Test)**: Create `packages/schemas/src/insights.test.ts`.
    - Assert that an insight with an invalid icon (e.g., "HackerIcon") throws a Zod error.
    - Assert `AggregateInsightSchema` requires `priority`.
2.  **GREEN (Implement)**: Update `packages/schemas/src/index.ts`.

    ```typescript
    import { z } from "zod";

    export const InsightIconEnum = z.enum([
      "Activity",
      "Sun",
      "BedDouble",
      "Utensils",
      "Clock",
      "TrendingUp",
      "TrendingDown",
      "AlertTriangle",
      "CheckCircle",
      "Info",
    ]);

    export const InsightPriorityEnum = z.enum([
      "CRITICAL",
      "SERIOUS",
      "IMPORTANT",
      "INFO",
    ]);

    // For Journal.analysisInsights
    export const AggregateInsightSchema = z.object({
      type: z.literal("aggregate"),
      title: z.string(),
      text: z.string(),
      priority: InsightPriorityEnum,
      icon: InsightIconEnum,
    });

    // For GlycemicEventCluster.insights
    export const ClusterInsightSchema = z.object({
      type: z.literal("cluster"),
      id: z.string().uuid(),
      title: z.string(),
      text: z.string(),
      icon: InsightIconEnum,
    });

    export type AggregateInsight = z.infer<typeof AggregateInsightSchema>;
    export type ClusterInsight = z.infer<typeof ClusterInsightSchema>;
    ```

3.  **REFACTOR**: Run `npm run build` in packages.

---

### Phase 2: Template Registry (Backend)

**Goal:** Create the "Safety Layer" with distinct sections for Aggregates and Clusters.

#### Cycle 2.1: Template Safety

1.  **RED (Test)**: Create `backend/tests/unit/insights.safety.test.ts`.
    - Import the (not yet created) `INSIGHT_TEMPLATES`.
    - Iterate through every template.
    - Assert `text` does **not** contain: "inject", "dose", "stop", "change", "increase", "decrease".
2.  **GREEN (Implement)**: Create `backend/src/lib/analysis/insights/templates.ts`.

    ```typescript
    export const AGGREGATE_TEMPLATES = {
      LOW_GLUCOSE_CRITICAL: {
        title: "High Hypoglycemia Risk",
        text: "You are spending significantly more time in hypoglycemia (>4%) than recommended. This is a safety priority. Discuss strategies to reduce lows with your doctor immediately.",
        priority: "CRITICAL",
        icon: "AlertTriangle",
      },
      GMI_HIGH: {
        title: "Elevated GMI",
        text: "Your estimated GMI is above target. Discuss with your provider if adjustments to your management plan are needed.",
        priority: "SERIOUS",
        icon: "TrendingUp",
      },
      TIR_LOW: {
        title: "Time in Range",
        text: "Time in Range is below 70%. Focusing on reducing highs or lows could help improve this.",
        priority: "IMPORTANT",
        icon: "Activity",
      },
    } as const;

    export const CLUSTER_TEMPLATES = {
      REBOUND: {
        title: "Possible Rebound",
        text: "We detected low glucose shortly before these highs. Discuss if this might be a body's reaction to a low (Somogyi effect).",
        icon: "Activity",
      },
      UNCOVERED_MEAL: {
        title: "Uncovered Meal",
        text: "Meals were recorded before these highs without a corresponding insulin dose. Discuss if missed boluses are a factor.",
        icon: "Utensils",
      },
      LATE_BOLUS: {
        title: "Bolus Timing",
        text: "Insulin was recorded at or after the start of the meal. Discuss if pre-bolusing (taking insulin earlier) could help.",
        icon: "Clock",
      },
      NON_MEAL_HIGH: {
        title: "Non-Meal High",
        text: "These highs occurred without recorded meals nearby. Consider factors like basal rates, stress, or dawn phenomenon.",
        icon: "Info",
      },
    } as const;
    ```

---

### Phase 3: Aggregate Logic (Journal Level)

**Goal:** Generate insights strictly for the AGP Chart based on weekly stats.

#### Cycle 3.1: Metric Analysis

1.  **RED (Test)**: Create `backend/tests/unit/insights.aggregate.test.ts`.
    - Mock `ScoreCardData` with `timeInTightRange: 2%` and `lowPercentage: 15%`.
    - Assert `generateAggregateInsights` returns the `LOW_GLUCOSE_CRITICAL` template.
2.  **GREEN (Implement)**: Create `backend/src/lib/analysis/insights/aggregateGenerator.ts`.

    ```typescript
    import { AGGREGATE_TEMPLATES } from "./templates";
    import { AggregateInsight } from "@goodnumbers/schemas";
    // Define a type that includes the extra fields calculated in worker but maybe not in strict schema yet
    type ExtendedScoreCard = {
      lowPercentage?: number;
      timeInRange: number;
      // ... other fields
    };

    export function generateAggregateInsights(
      metrics: ExtendedScoreCard,
    ): AggregateInsight[] {
      const insights: AggregateInsight[] = [];

      // 1. Safety Check (Lows)
      if (metrics.lowPercentage && metrics.lowPercentage > 4) {
        insights.push({
          type: "aggregate",
          ...AGGREGATE_TEMPLATES.LOW_GLUCOSE_CRITICAL,
        });
      }

      // 2. TIR Check
      if (metrics.timeInRange < 70) {
        insights.push({
          type: "aggregate",
          ...AGGREGATE_TEMPLATES.TIR_LOW,
        });
      }

      return insights;
    }
    ```

---

### Phase 4: Cluster Logic (Event Level)

**Goal:** Generate insights strictly for specific cards (Rebound, Meals).

#### Cycle 4.1: Meal Analysis Logic

1.  **RED (Test)**: Create `backend/tests/unit/insights.cluster.test.ts`.
    - **Case: Uncovered Meal.** Create a mock Hyper Event at 12:00. Create a Carb entry at 11:45. Create **NO** insulin entry. Assert `UNCOVERED_MEAL` insight.
    - **Case: Late Bolus.** Create Hyper at 12:00. Carb at 11:30. Insulin at 11:40 (10 mins after carbs). Assert `LATE_BOLUS` insight.
2.  **GREEN (Implement)**: Create `backend/src/lib/analysis/insights/clusterGenerator.ts`.

    ```typescript
    import { CLUSTER_TEMPLATES } from "./templates";
    import { GlycemicCluster } from "@goodnumbers/types";
    import { ClusterInsight } from "@goodnumbers/schemas";
    import { v4 as uuidv4 } from "uuid";

    // Helper to optimize lookups
    function getTreatmentsInWindow(
      treatments: any[],
      start: number,
      end: number,
    ) {
      return treatments.filter((t) => t.date >= start && t.date <= end);
    }

    export function generateClusterInsights(
      cluster: GlycemicCluster,
      context: { treatments: any[]; hypos: any[] },
    ): ClusterInsight[] {
      const insights: ClusterInsight[] = [];
      const { treatments, hypos } = context;

      if (cluster.type === "hyper") {
        let uncoveredCount = 0;
        let lateBolusCount = 0;

        cluster.events.forEach((event) => {
          const eventTime = new Date(event.startTime).getTime();
          const lookbackStart = eventTime - 180 * 60 * 1000; // 3 hours

          const windowTreatments = getTreatmentsInWindow(
            treatments,
            lookbackStart,
            eventTime,
          );
          const carbs = windowTreatments.filter((t) => t.carbs > 0);
          const insulin = windowTreatments.filter((t) => t.insulin > 0);

          const hasCarbs = carbs.length > 0;
          const hasInsulin = insulin.length > 0;

          if (hasCarbs && !hasInsulin) {
            uncoveredCount++;
          } else if (hasCarbs && hasInsulin) {
            // Check timing: Insulin AFTER carbs?
            // Simplistic check: If first insulin time >= first carb time
            const firstCarbTime = Math.min(...carbs.map((t) => t.date));
            const firstInsulinTime = Math.min(...insulin.map((t) => t.date));

            // Tolerance of 5 minutes
            if (firstInsulinTime > firstCarbTime - 5 * 60 * 1000) {
              lateBolusCount++;
            }
          }
        });

        const total = cluster.events.length;
        if (uncoveredCount / total > 0.5) {
          insights.push({
            type: "cluster",
            id: uuidv4(),
            ...CLUSTER_TEMPLATES.UNCOVERED_MEAL,
          });
        } else if (lateBolusCount / total > 0.5) {
          insights.push({
            type: "cluster",
            id: uuidv4(),
            ...CLUSTER_TEMPLATES.LATE_BOLUS,
          });
        }
      }

      return insights;
    }
    ```

#### Cycle 4.2: Physiological Logic (Rebound)

1.  **RED (Test)**: Add test case for Rebound. Mock Hyper cluster at 08:00. Mock Hypo event at 05:00. Assert `REBOUND` insight.
2.  **GREEN (Implement)**: Add Rebound logic to `clusterGenerator.ts` (filtering hypos relative to cluster start time).

---

### Phase 5: Worker Integration

**Goal:** Connect the logic to the background job and save to the correct DB fields.

#### Cycle 5.1: Integrate

1.  **RED (Test)**: Update `backend/tests/integration/worker/journalProcessor.test.ts`.
    - Mock `generateAggregateInsights` and `generateClusterInsights`.
    - Assert that `prisma.journal.update` is called with `analysisInsights` (Aggregate).
    - Assert that `prisma.glycemicEventCluster.createMany` includes `insights` (Cluster).
2.  **GREEN (Implement)**: Update `backend/src/worker.ts`.

    ```typescript
    // ... imports
    import { generateAggregateInsights } from "./lib/analysis/insights/aggregateGenerator";
    import { generateClusterInsights } from "./lib/analysis/insights/clusterGenerator";

    // Inside processJournalJob...

    // 1. Calculate Aggregates (For AGP Chart)
    // Note: Ensure scoreCardData has lowPercentage. If not, calculate it from entries.
    const aggInsights = generateAggregateInsights(scoreCardData);

    // 2. Calculate Clusters (For Event Cards)
    const allClusters = [
      ...hyperClusters.map((c) => ({
        ...c,
        insights: generateClusterInsights(c, { treatments, hypos: hypoEvents }),
      })),
      // ... same for hypoClusters
    ];

    // 3. Save
    await prisma.journal.update({
      data: {
        analysisInsights: aggInsights, // <--- GOES TO JOURNAL
        // ...
      },
    });

    // ...
    prisma.glycemicEventCluster.createMany({
      data: allClusters.map((c) => ({
        // ...
        insights: c.insights, // <--- GOES TO CLUSTER
      })),
    });
    ```

---

### Phase 6: Frontend Rendering

**Goal:** Display the new data in the correct locations.

#### Cycle 6.1: Chart Analysis Card (Aggregates)

1.  **RED (Test)**: Update `frontend/src/components/journal/ChartAnalysisCard.test.tsx`. Pass in `insights` with `icon: 'AlertTriangle'`. Assert the icon renders.
2.  **GREEN (Implement)**: Update `ChartAnalysisCard.tsx` to map the string icon name to the actual Lucide component.

#### Cycle 6.2: Event Cluster Card (Clusters)

1.  **RED (Test)**: Update `frontend/src/components/journal/EventClusterCard.test.tsx`. Assert "Discussion Topics" section appears when insights exist.
2.  **GREEN (Implement)**: Update `EventClusterCard.tsx` to render the insights list at the bottom of the card.

---

## 4. Database Schema Updates

Run this migration in Phase 1.

```prisma
// backend/prisma/schema.prisma

model GlycemicEventCluster {
  // ... existing fields
  insights Json? // Array of ClusterInsight objects
}

// Journal model already has analysisInsights Json?
```

## 5. Summary of New Files

1.  `packages/schemas/src/insights.ts` (Validation)
2.  `backend/src/lib/analysis/insights/templates.ts` (Static Text)
3.  `backend/src/lib/analysis/insights/aggregateGenerator.ts` (Logic)
4.  `backend/src/lib/analysis/insights/clusterGenerator.ts` (Logic)
5.  `backend/tests/unit/insights.*.test.ts` (Tests)
