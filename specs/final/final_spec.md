# NON_AI_CLINICAL_INSIGHTS

**TL;DR**: Implement a deterministic, clinically-informed heuristic engine to generate educational discussion topics for glycemic clusters, using a strict **Red-Green-Refactor TDD** workflow and **Templated Safety** to prevent medical advice generation.

### Invariants (do not change)

1.  **Template-Based Safety**: Insights **must** be derived from a static registry of pre-approved templates (`templates.ts`). Dynamic string concatenation of medical advice is strictly forbidden to prevent accidental generation of imperative commands.
2.  **Regulatory Safety**: Templates **must never** use imperative verbs regarding treatment (e.g., "Inject," "Change," "Increase," "Stop"). Use "Soft" observational language: "Discuss," "Ask about," "Consider tracking."
3.  **Determinism**: The same inputs (Cluster + Context) must always yield the exact same insight strings.
4.  **Algorithmic Safety**: Heuristics must use optimized lookups (e.g., pre-filtering time windows) to avoid $O(N \times M)$ complexity that could cause DoS during background processing.

### Assumptions & Scope

- **Assumption**: `HotspotDetector` correctly identifies clusters.
- **Assumption**: `treatments` and `hypoEvents` are available in the worker scope.
- **Scope**:
  - **Shared**: Zod schema definition with strict Icon whitelisting.
  - **Backend**: Prisma schema update, Template registry, Heuristic logic, Worker integration.
  - **Frontend**: UI update to `EventClusterCard`.
  - **Out of Scope**: LLM/AI integration, TTS.

### Objectives

1.  **Clinical Depth**: Identify specific scenarios: Rebound Highs, Dawn Phenomenon, Compression Lows, and Meal Spikes.
2.  **Safety**: 100% of generated strings come from the approved Template Registry.
3.  **Performance**: Insight generation adds negligible overhead (<50ms per journal) via optimized loops.

### Risks & Mitigations

- **Risk**: Unvetted text entering the system via dynamic string building.
  - **Mitigation**: Use `INSIGHT_TEMPLATES` constant. Code review must reject any string literal in `generators.ts` that isn't a UUID or debug log.
- **Risk**: DoS via nested loops on large datasets (noisy sensors).
  - **Mitigation**: Filter comparison arrays (e.g., hypos) to the relevant time window _before_ iterating through cluster events.
- **Risk**: Stored XSS via Icon injection.
  - **Mitigation**: Use a strict Zod Enum for `icon` in the shared schema.

### Method Outline

1.  **Shared Contract**: Define `ClusterInsight` schema in `packages/schemas` with strict validation.
2.  **Database**: Add `insights` JSON column to `GlycemicEventCluster`.
3.  **Safety Layer**: Create `backend/src/lib/analysis/insights/templates.ts`.
4.  **Logic Engine**: Implement optimized generators in `backend/src/lib/analysis/insights/generators.ts`.
5.  **Worker Integration**: Calculate insights in memory and persist.
6.  **UI**: Update `EventClusterCard` to render.

### Implementation Notes

- **Schema**:
  ```prisma
  model GlycemicEventCluster {
    // ...
    insights Json? // Stored as ClusterInsight[]
  }
  ```
- **Performance**: Do not re-fetch data. Pass the data already in memory in `worker.ts`.
- **Privacy**: Do not log specific medical details (e.g., "Found Rebound") in the worker console. Log counts only: "Generated 3 insights".

### Acceptance Gates

- [ ] **Schema**: `insights` column exists.
- [ ] **Types**: `ClusterInsight` type uses strict Icon Enum.
- [ ] **Logic**: "Rebound" insight triggers only when a Hypo precedes a Hyper in the same cluster.
- [ ] **Safety**: Unit tests confirm generated text matches Templates exactly.

### "Make-sure-you" Checklist

- [ ] Run `npm run build` in `packages/schemas` after adding the new Zod schema.
- [ ] Ensure `treatments` and `hypoEvents` are sorted by date before passing to generators.
- [ ] **Crucial**: In `generators.ts`, filter the context arrays to the specific time window of the cluster before iterating to prevent $O(N^2)$ issues.

### Project hygiene prep

1.  Create branch `feat/clinical-insights`.
2.  Create GitHub Issue: "Implement Non-AI Clinical Insights".
3.  **Strict TDD**: Follow the cycles below.

---

### In-depth Test Plan

#### 1. Unit Tests: Safety & Templates (`backend/tests/unit/insights.safety.test.ts`)

- **Case 1: Template Safety**: Iterate over `INSIGHT_TEMPLATES`. Assert no value contains prohibited words (`inject`, `dose`, `change`).
- **Case 2: Template Integrity**: Assert `generateInsights` returns the _exact reference_ string from the template, not a reconstructed string.

#### 2. Unit Tests: Generators (`backend/tests/unit/insights.logic.test.ts`)

- **Case 1: Rebound Detection**: Mock a Hyper cluster starting at 8:00. Mock a Hypo ending at 5:00. Assert "Possible Rebound" insight is generated.
- **Case 2: Compression Lows**: Mock a Hypo cluster at 3:00 AM with duration 15m. Assert "Sensor Compression" insight.
- **Case 3: Dawn Phenomenon**: Mock a Hyper cluster at 6:00 AM. Assert "Morning Rise" insight.

#### 3. Integration Tests: Privacy (`backend/tests/integration/privacy.test.ts`)

- **Case**: Create a user with a journal and clusters containing insights. Delete the user. Verify insights data is gone.

---

### In-depth Engineering Plan (TDD Process)

#### Cycle 1: Shared Schema & Database

1.  **RED (Write Test)**:
    - Create `packages/schemas/src/insights.test.ts`.
    - Test that `ClusterInsightSchema` rejects invalid icons (e.g., "HackerIcon").
    - Run: `npm test -w packages/schemas` -> **FAIL**.

2.  **GREEN (Implementation)**:
    - Edit `packages/schemas/src/index.ts`:

      ```typescript
      import { z } from "zod";

      // Whitelist allowed icons to prevent UI injection/breakage
      export const AllowedInsightIcons = [
        "Activity",
        "Sun",
        "BedDouble",
        "Calendar",
        "Info",
      ] as const;

      export const ClusterInsightSchema = z.object({
        id: z.string().uuid(),
        title: z.string().max(100),
        text: z.string().max(500),
        category: z.enum([
          "clinical",
          "behavioral",
          "sensor",
          "treatment",
          "general",
        ]),
        icon: z.enum(AllowedInsightIcons).optional(),
      });

      export type ClusterInsight = z.infer<typeof ClusterInsightSchema>;
      ```

    - Run: `npm run build -w packages/schemas`.
    - Run: `npm test -w packages/schemas` -> **PASS**.

3.  **REFACTOR (Database)**:
    - Modify `backend/prisma/schema.prisma`: Add `insights Json?` to `GlycemicEventCluster`.
    - Run: `npx prisma migrate dev --name add_clinical_insights`.
    - Run: `npm run generate -w packages/types`.

#### Cycle 2: Templates & Logic (Backend)

1.  **RED (Write Test)**:
    - Create `backend/tests/unit/insights.logic.test.ts`.
    - Paste:

      ```typescript
      import { describe, it, expect } from "vitest";
      // @ts-ignore - pending implementation
      import { generateInsights } from "../../src/lib/analysis/insights/generators";
      // @ts-ignore - pending implementation
      import { INSIGHT_TEMPLATES } from "../../src/lib/analysis/insights/templates";
      import type { GlycemicCluster, GlycemicEvent } from "@goodnumbers/types";

      describe("Clinical Heuristics", () => {
        it("detects Rebound Highs using Template", () => {
          const cluster: GlycemicCluster = {
            type: "hyper",
            events: [{ startTime: "2023-01-01T08:00:00Z" } as any],
            avgStartMinute: 480,
          } as any;
          const hypoEvents: GlycemicEvent[] = [
            {
              endTime: "2023-01-01T05:00:00Z",
              type: "hypo",
            } as any,
          ];

          const insights = generateInsights(cluster, {
            hypoEvents,
            treatments: [],
          });

          // STRICT EQUALITY CHECK against Template
          expect(insights[0].text).toBe(INSIGHT_TEMPLATES.REBOUND.text);
          expect(insights[0].title).toBe(INSIGHT_TEMPLATES.REBOUND.title);
        });
      });
      ```

    - Run: `npm test backend/tests/unit/insights.logic.test.ts` -> **FAIL**.

2.  **GREEN (Implementation)**:
    - Create `backend/src/lib/analysis/insights/templates.ts`:
      ```typescript
      export const INSIGHT_TEMPLATES = {
        REBOUND: {
          title: "Possible Rebound (Somogyi Effect)",
          text: 'We detected low glucose events shortly before these highs. Discuss with your doctor if this might be a "rebound" reaction where the body releases sugar to counter a low.',
          category: "clinical",
          icon: "Activity",
        },
        COMPRESSION: {
          title: "Possible Sensor Compression",
          text: 'Short, overnight drops can sometimes be caused by lying on the sensor ("Compression Lows") rather than actual low blood sugar.',
          category: "sensor",
          icon: "BedDouble",
        },
        DAWN: {
          title: "Morning Rise",
          text: 'Highs in the early morning are often related to the "Dawn Phenomenon" (hormonal surges). Discuss checking your overnight basal rates.',
          category: "clinical",
          icon: "Sun",
        },
        FALLBACK: {
          title: "Recurring Pattern",
          text: "This pattern was detected on multiple days.", // Note: Dynamic part handled safely in generator
          category: "general",
          icon: "Calendar",
        },
      } as const;
      ```
    - Create `backend/src/lib/analysis/insights/generators.ts`:

      ```typescript
      import { GlycemicCluster, GlycemicEvent } from "@goodnumbers/types";
      import { ClusterInsight } from "@goodnumbers/schemas";
      import { INSIGHT_TEMPLATES } from "./templates";
      import { v4 as uuidv4 } from "uuid";

      interface InsightContext {
        hypoEvents: GlycemicEvent[];
        treatments: any[];
      }

      export function generateInsights(
        cluster: GlycemicCluster,
        ctx: InsightContext,
      ): ClusterInsight[] {
        const insights: ClusterInsight[] = [];

        // 1. Rebound (Optimized)
        if (cluster.type === "hyper" && cluster.events.length > 0) {
          // Optimization: Define search window relative to the FIRST event in cluster
          // to avoid scanning the entire hypo array unnecessarily.
          const clusterStart = new Date(cluster.events[0].startTime).getTime();
          const searchStart = clusterStart - 4 * 60 * 60 * 1000; // 4 hours prior

          // Filter hypos to this window FIRST
          const relevantHypos = ctx.hypoEvents.filter((h) => {
            const t = new Date(h.endTime || h.startTime).getTime();
            return t > searchStart && t < clusterStart;
          });

          if (relevantHypos.length > 0) {
            const tmpl = INSIGHT_TEMPLATES.REBOUND;
            insights.push({
              id: uuidv4(),
              title: tmpl.title,
              text: tmpl.text,
              category: tmpl.category as any,
              icon: tmpl.icon as any,
            });
          }
        }

        // 2. Compression Low
        if (
          cluster.type === "hypo" &&
          (cluster.avgStartMinute < 420 || cluster.avgStartMinute > 1320) &&
          cluster.avgDurationMinutes < 30
        ) {
          const tmpl = INSIGHT_TEMPLATES.COMPRESSION;
          insights.push({
            id: uuidv4(),
            title: tmpl.title,
            text: tmpl.text,
            category: tmpl.category as any,
            icon: tmpl.icon as any,
          });
        }

        // 3. Dawn Phenomenon
        if (
          cluster.type === "hyper" &&
          cluster.avgStartMinute >= 240 &&
          cluster.avgStartMinute <= 480
        ) {
          const tmpl = INSIGHT_TEMPLATES.DAWN;
          insights.push({
            id: uuidv4(),
            title: tmpl.title,
            text: tmpl.text,
            category: tmpl.category as any,
            icon: tmpl.icon as any,
          });
        }

        // Fallback
        if (insights.length === 0) {
          const tmpl = INSIGHT_TEMPLATES.FALLBACK;
          insights.push({
            id: uuidv4(),
            title: tmpl.title,
            text: `${tmpl.text} (Count: ${cluster.activeDays?.length || 0})`, // Safe interpolation of numbers only
            category: tmpl.category as any,
            icon: tmpl.icon as any,
          });
        }
        return insights;
      }
      ```

    - Run: `npm test backend/tests/unit/insights.logic.test.ts` -> **PASS**.

#### Cycle 3: Worker Integration

1.  **RED (Write Test)**:
    - Modify `backend/tests/integration/worker/journalProcessor.test.ts`.
    - Verify `prisma.glycemicEventCluster.createMany` is called with `insights`.
    - Run: `npm test backend/tests/integration/worker/journalProcessor.test.ts` -> **FAIL**.

2.  **GREEN (Implementation)**:
    - Modify `backend/src/worker.ts`:
      - Import `generateInsights`.
      - **CRITICAL**: Pass `hypoEvents` to the hyper cluster generator.

        ```typescript
        // In processJournalJob...
        const hyperEvents = detector.detectEvents(glucoseEntries, "hyper", 180);
        const hypoEvents = detector.detectEvents(glucoseEntries, "hypo", 70);

        const hyperClusters = detector.findClusters(hyperEvents);
        const hypoClusters = detector.findClusters(hypoEvents);

        const allClusters = [
          ...hyperClusters.map((c) => ({
            ...c,
            // Pass raw hypoEvents for rebound detection context
            insights: generateInsights(c, { hypoEvents, treatments }),
          })),
          ...hypoClusters.map((c) => ({
            ...c,
            insights: generateInsights(c, { hypoEvents: [], treatments }),
          })),
        ];
        ```

      - Update persistence:
        ```typescript
        data: allClusters.map((c) => ({
          // ...
          insights: c.insights as unknown as Prisma.InputJsonValue,
        })),
        ```

    - Run: `npm test backend/tests/integration/worker/journalProcessor.test.ts` -> **PASS**.

#### Cycle 4: Frontend UI

1.  **RED (Write Test)**:
    - Modify `frontend/src/components/journal/EventClusterCard.test.tsx`.
    - Add test case ensuring insights render.
    - Run: `npm test frontend/src/components/journal/EventClusterCard.test.tsx` -> **FAIL**.

2.  **GREEN (Implementation)**:
    - Modify `frontend/src/components/journal/EventClusterCard.tsx`.
    - Import icons: `import { Activity, Sun, BedDouble, Calendar, Info } from 'lucide-react';`
    - Map icons safely: `const IconMap: Record<string, any> = { Activity, Sun, BedDouble, Calendar };`
    - Render logic:
      ```tsx
      {
        cluster.insights && (cluster.insights as any[]).length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Discussion Topics
            </h4>
            <div className="space-y-3">
              {(cluster.insights as any[]).map((insight) => {
                // FALLBACK to Info icon if database string is invalid/unknown
                const Icon = IconMap[insight.icon || ""] || Info;
                return (
                  <div
                    key={insight.id}
                    className="flex gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-mesa-secondary" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        {insight.title}
                      </div>
                      <div className="text-sm text-gray-700 mt-0.5 leading-snug">
                        {insight.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      ```
    - Run: `npm test frontend/src/components/journal/EventClusterCard.test.tsx` -> **PASS**.
