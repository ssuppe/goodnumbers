# ENGINEERING DESIGN: STATISTICAL INSIGHTS ENGINE (SECURE TDD)

## TL;DR

Implement deterministic, security-hardened statistical analysis engines to populate `Journal.analysisInsights` and `GlycemicEventCluster.insights` using a strict Test-Driven Development (TDD) workflow with mandatory Zod validation.

## Invariants (do not change)

1.  **No AI Dependencies**: Insights must be generated via deterministic algorithms (TypeScript).
2.  **Data Privacy**: Insight generation occurs strictly server-side. **NO PHI** (glucose values, insulin amounts) in logs. Log IDs only.
3.  **Input Sanitization**: All text outputs must be validated via Zod to prevent Stored XSS.
4.  **Timezone Safety**: All temporal comparisons must use UTC Epoch Milliseconds.
5.  **TDD Mandate**: No production code is written without a failing test first.

## Assumptions & Scope

- **Assumption**: `NightscoutTreatment` objects contain `date` (epoch ms) or `created_at` (ISO). We normalize to epoch ms immediately.
- **Scope**: Shared Types/Schemas, Backend generators, Prisma schema, Worker integration, Frontend display.
- **Out of Scope**: LLM integration, new data fetching.

## Objectives

1.  **Schema**: Persist cluster-level insights in SQLite with strict JSON validation.
2.  **Aggregate Analysis**: Port GMI/TIR logic to backend.
3.  **Cluster Analysis**: Implement meal-correlation logic with DoS protection (complexity limits).
4.  **Visualization**: Render insights on `AGPChart` and `EventClusterCard` safely.

## Risks & Mitigations

- **Risk**: Stored XSS via malicious strings in Nightscout data.
  - _Mitigation_: Zod `refine` check to reject HTML characters; React default escaping.
- **Risk**: DoS via `O(N*M)` complexity in cluster analysis.
  - _Mitigation_: Enforce hard limit on treatments (10k) and pre-sort by date.
- **Risk**: JSON "Blindness" (Schema drift).
  - _Mitigation_: Validate all JSON writes and reads against `InsightArraySchema`.

## Method Outline

1.  **Shared Types & Schemas**: Define `Insight` in `@goodnumbers/types` and Zod validators in `@goodnumbers/schemas`.
2.  **Schema**: Add `insights` JSON to `GlycemicEventCluster`.
3.  **Logic**: Implement `aggregate.ts` and `cluster.ts` via TDD.
4.  **Integration**: Wire into Worker with validation guards via TDD.
5.  **UI**: Update components via TDD.

## Implementation Notes

- **Precision**: Use `Math.round` for display values.
- **Performance**: Sort treatments by date _once_ before iterating clusters.
- **Security**: Use `safeParse` for all JSON operations.

## Acceptance Gates

1.  `npm run test:backend` passes with 100% coverage for `src/lib/insights`.
2.  Security tests (XSS rejection, Malformed JSON) pass.
3.  Worker successfully persists insights to DB.
4.  Frontend renders insights without using `dangerouslySetInnerHTML`.

## "Make-sure-you" Checklist

- [ ] Run `npm run db:migrate` immediately after schema change.
- [ ] Ensure `InsightPriority` strings match frontend expectations exactly.
- [ ] **Verify no `console.log` prints glucose/insulin values.**
- [ ] Commit after every GREEN step.

## Project Hygiene Prep

1.  **Branch**: `git checkout -b feat/statistical-insights`
2.  **Issue**: Create GitHub issue "Implement Statistical Insights".

---

## In-depth Test Plan & Engineering Plan (Combined TDD Flow)

### Phase 1: Foundation (Types, Schemas, DB)

**Step 1.1: Define Types & Zod Schemas (RED)**

- **Goal**: Establish the contract and security validators.
- **Action**: Create `packages/types/src/insights.ts` and `packages/schemas/src/insights.ts`.
- **Code (Types)**:
  ```typescript
  export enum InsightPriority {
    CRITICAL = "CRITICAL",
    SERIOUS = "SERIOUS",
    IMPORTANT = "IMPORTANT",
    INFO = "ALWAYS_INCLUDE",
  }
  export interface Insight {
    priority: InsightPriority;
    note: string;
  }
  ```
- **Code (Schemas)**:

  ```typescript
  import { z } from "zod";
  import { InsightPriority } from "@goodnumbers/types";

  export const InsightSchema = z.object({
    priority: z.nativeEnum(InsightPriority),
    // SECURITY: Prevent HTML injection at the validation layer
    note: z
      .string()
      .max(500)
      .refine((val) => !/[<>]/.test(val), {
        message: "Insight notes cannot contain HTML characters",
      }),
  });
  export const InsightArraySchema = z.array(InsightSchema);
  ```

- **Action**: Export from respective `index.ts` files. Run `npm run build` in packages.

**Step 1.2: Update Database Schema (RED)**

- **Action**: Update `backend/prisma/schema.prisma`.
  ```prisma
  model GlycemicEventCluster {
    // ... existing fields
    insights Json? // Validated via Zod in app layer
  }
  ```
- **Action**: Run `npx prisma migrate dev --name add_cluster_insights`.
- **Test**: Run `npm run test:backend` to ensure no regressions.

---

### Phase 2: Aggregate Insights (TDD)

**Step 2.1: Create Test File (RED)**

- **File**: `backend/tests/unit/insights/aggregate.test.ts`
- **Code**:

  ```typescript
  import { describe, it, expect } from "vitest";
  import { generateAggregateInsights } from "@src/lib/insights/aggregate";
  import { InsightPriority } from "@goodnumbers/types";

  describe("Aggregate Insights", () => {
    it("generates CRITICAL warning for low average glucose (<70)", () => {
      const entries = Array(10).fill({ sgv: 50, date: Date.now() });
      const insights = generateAggregateInsights(entries);
      expect(insights).toContainEqual(
        expect.objectContaining({
          priority: InsightPriority.CRITICAL,
          note: expect.stringContaining("hypoglycemia"),
        })
      );
    });

    it("calculates GMI correctly (Mean 150 -> ~6.9%)", () => {
      const entries = Array(10).fill({ sgv: 150, date: Date.now() });
      const insights = generateAggregateInsights(entries);
      expect(insights).toContainEqual(
        expect.objectContaining({
          priority: InsightPriority.INFO,
          note: expect.stringContaining("6.9%"),
        })
      );
    });
  });
  ```

- **Command**: `npm run test:backend` -> **FAIL** (Module not found).

**Step 2.2: Implement Logic (GREEN)**

- **File**: `backend/src/lib/insights/aggregate.ts`
- **Code**:

  ```typescript
  import { Insight, InsightPriority, GlucoseEntry } from "@goodnumbers/types";

  export function generateAggregateInsights(
    entries: GlucoseEntry[]
  ): Insight[] {
    if (!entries.length) return [];
    const insights: Insight[] = [];
    const sum = entries.reduce((acc, e) => acc + e.sgv, 0);
    const avg = sum / entries.length;

    // GMI Logic: 3.31 + (0.02392 * mean)
    const gmi = 3.31 + 0.02392 * avg;
    insights.push({
      priority: InsightPriority.INFO,
      note: `Estimated GMI: ${gmi.toFixed(1)}%`,
    });

    // Low Glucose Logic
    if (avg < 70) {
      insights.push({
        priority: InsightPriority.CRITICAL,
        note: "Average glucose indicates frequent hypoglycemia.",
      });
    }
    return insights;
  }
  ```

- **Command**: `npm run test:backend` -> **PASS**.

---

### Phase 3: Cluster Insights (TDD)

**Step 3.1: Create Test File (RED)**

- **File**: `backend/tests/unit/insights/cluster.test.ts`
- **Code**:

  ```typescript
  import { describe, it, expect } from "vitest";
  import { generateClusterInsights } from "@src/lib/insights/cluster";
  import { InsightPriority } from "@goodnumbers/types";

  describe("Cluster Insights", () => {
    const mockCluster = {
      avgStartMinute: 720, // 12:00 PM
      events: [{ startTime: "2023-01-01T12:00:00Z" }],
    };

    it("detects uncovered meal (Carbs > 0, Insulin = 0)", () => {
      const treatments = [
        {
          date: new Date("2023-01-01T11:30:00Z").getTime(), // 30 mins before
          carbs: 50,
          insulin: 0,
        },
      ];
      const insights = generateClusterInsights(
        mockCluster as any,
        treatments as any
      );
      expect(insights).toContainEqual(
        expect.objectContaining({
          priority: InsightPriority.IMPORTANT,
          note: expect.stringContaining("uncovered"),
        })
      );
    });

    it("ignores meals outside 3h lookback window", () => {
      const treatments = [
        {
          date: new Date("2023-01-01T08:00:00Z").getTime(), // 4 hours before
          carbs: 50,
        },
      ];
      const insights = generateClusterInsights(
        mockCluster as any,
        treatments as any
      );
      expect(insights).toHaveLength(0);
    });

    // SECURITY TEST
    it("sanitizes or ignores malicious input in treatment notes", () => {
      // We don't use treatment notes in the output string, but let's ensure we don't crash
      const treatments = [
        {
          date: new Date("2023-01-01T11:30:00Z").getTime(),
          carbs: 50,
          insulin: 0,
          notes: "<script>alert(1)</script>",
        },
      ];
      const insights = generateClusterInsights(
        mockCluster as any,
        treatments as any
      );
      // Ensure the note generated is standard static text, not dynamic
      expect(insights[0].note).not.toContain("<script>");
    });
  });
  ```

- **Command**: `npm run test:backend` -> **FAIL**.

**Step 3.2: Implement Logic (GREEN)**

- **File**: `backend/src/lib/insights/cluster.ts`
- **Code**:

  ```typescript
  import {
    Insight,
    InsightPriority,
    GlycemicCluster,
  } from "@goodnumbers/types";

  interface Treatment {
    date: number;
    carbs?: number;
    insulin?: number;
  }

  export function generateClusterInsights(
    cluster: GlycemicCluster,
    treatments: Treatment[]
  ): Insight[] {
    const insights: Insight[] = [];
    let uncoveredCount = 0;

    // Optimization: Treatments should be pre-sorted by caller, but we filter linearly here
    // assuming N is small after pre-filtering in worker.

    cluster.events.forEach((event) => {
      const eventTime = new Date(event.startTime).getTime();
      const lookback = eventTime - 180 * 60 * 1000; // 3 hours

      // SECURITY: Use Epoch MS for comparison
      const relevant = treatments.filter(
        (t) => t.date >= lookback && t.date <= eventTime
      );

      const hasCarbs = relevant.some((t) => (t.carbs || 0) > 0);
      const hasInsulin = relevant.some((t) => (t.insulin || 0) > 0);

      if (hasCarbs && !hasInsulin) uncoveredCount++;
    });

    if (uncoveredCount > 0) {
      // SECURITY: Use static string templates, do not inject raw treatment data
      insights.push({
        priority: InsightPriority.IMPORTANT,
        note: `Potential uncovered meals detected in ${uncoveredCount} events.`,
      });
    }
    return insights;
  }
  ```

- **Command**: `npm run test:backend` -> **PASS**.

---

### Phase 4: Worker Integration (TDD)

**Step 4.1: Update Integration Test (RED)**

- **File**: `backend/tests/integration/worker/journalProcessor.test.ts`
- **Action**: Update existing test to expect `insights` in DB calls.
- **Code Update**:

  ```typescript
  // ... inside test ...
  // Verify Cluster Creation includes insights
  const createCall = mockPrismaCreateMany.mock.calls[0][0];
  expect(createCall.data[0]).toHaveProperty("insights");

  // Verify Journal Update includes analysisInsights
  const updateCall = mockPrismaUpdate.mock.calls.find(
    (c: any) => c[0].data.status === "COMPLETE"
  );
  expect(updateCall[0].data).toHaveProperty("analysisInsights");
  ```

- **Command**: `npm run test:backend` -> **FAIL**.

**Step 4.2: Update Worker (GREEN)**

- **File**: `backend/src/worker.ts`
- **Action**: Import generators, schemas, and integrate.
- **Code**:

  ```typescript
  import { generateAggregateInsights } from "./lib/insights/aggregate.js";
  import { generateClusterInsights } from "./lib/insights/cluster.js";
  import { InsightArraySchema } from "@goodnumbers/schemas";

  // ... inside processJournalJob ...

  // 1. Aggregate Insights
  const rawAnalysisInsights = generateAggregateInsights(glucoseEntries);
  // SECURITY: Validate
  const analysisInsights = InsightArraySchema.parse(rawAnalysisInsights);

  // 2. Cluster Insights (inside loop)
  // Optimization: Sort treatments once
  treatments.sort((a, b) => a.date - b.date);

  const allClusters = [...hyperClusters, ...hypoClusters];
  const clusterData = allClusters.map((c) => {
    const rawInsights = generateClusterInsights(c, treatments);

    // SECURITY: Validate before DB write
    const safeInsights = InsightArraySchema.safeParse(rawInsights);
    if (!safeInsights.success) {
      console.error(`[Worker] Insight validation failed for cluster ${c.id}`);
      return {
        // ... other fields
        insights: [] as unknown as Prisma.InputJsonValue,
      };
    }

    return {
      journalId,
      eventType: c.type,
      eventCount: c.eventCount,
      meanTimeMinutes: c.avgStartMinute,
      clusterDataJson: c as unknown as Prisma.InputJsonValue,
      insights: safeInsights.data as unknown as Prisma.InputJsonValue,
    };
  });

  // 3. Save
  await prisma.glycemicEventCluster.createMany({ data: clusterData });

  await prisma.journal.update({
    // ...
    data: {
      // ...
      analysisInsights: analysisInsights as unknown as Prisma.InputJsonValue,
    },
  });
  ```

- **Command**: `npm run test:backend` -> **PASS**.

---

### Phase 5: Frontend Display (TDD)

**Step 5.1: Update Component Test (RED)**

- **File**: `frontend/src/components/journal/EventClusterCard.test.tsx`
- **Code**:

  ```typescript
  import { InsightPriority } from '@goodnumbers/types';

  it('renders insights when provided', () => {
    const insights = [{ priority: InsightPriority.IMPORTANT, note: 'Uncovered meal' }];
    render(
      <EventClusterCard
        cluster={mockCluster}
        insights={insights}
        // ... other props
      />
    );
    expect(screen.getByText('Uncovered meal')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
  });
  ```

- **Command**: `npm run test:frontend` -> **FAIL**.

**Step 5.2: Update Component (GREEN)**

- **File**: `frontend/src/components/journal/EventClusterCard.tsx`
- **Code**:

  ```typescript
  import { Insight, InsightPriority } from '@goodnumbers/types';

  interface EventClusterCardProps {
    // ... existing
    insights?: Insight[];
  }

  // Helper for styling (match ChartAnalysisCard)
  const getBgColor = (priority: InsightPriority) => {
    switch (priority) {
      case InsightPriority.CRITICAL: return "bg-red-50 border-red-100 text-red-900";
      case InsightPriority.SERIOUS: return "bg-amber-50 border-amber-100 text-amber-900";
      case InsightPriority.IMPORTANT: return "bg-blue-50 border-blue-100 text-blue-900";
      default: return "bg-gray-50 border-gray-100 text-gray-700";
    }
  };

  export default function EventClusterCard({ insights, ...props }: EventClusterCardProps) {
    // ... existing render logic

    return (
      <div className="...">
        {/* ... Chart ... */}

        {/* New Insight Section */}
        {insights && insights.length > 0 && (
          <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-4">
             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Analysis</h4>
             {insights.map((i, idx) => (
               <div key={idx} className={`p-3 rounded-lg text-sm border ${getBgColor(i.priority)}`}>
                 {/* SECURITY: React escapes children by default. Do NOT use dangerouslySetInnerHTML */}
                 {i.note}
               </div>
             ))}
          </div>
        )}

        {/* ... User Notes ... */}
      </div>
    );
  }
  ```

- **Command**: `npm run test:frontend` -> **PASS**.

**Step 5.3: Update Page Integration (RED/GREEN)**

- **File**: `frontend/src/pages/JournalPage.tsx`
- **Action**: Pass `cluster.insights` (casted as `Insight[]`) to the card.
- **Test**: Manual verification or update `JournalPage.test.tsx` to mock response with insights.
