# {{Voyager Glucose Scorecards}} — `todo.md`

## TL;DR

Implement "Voyager Glucose Scorecards" (Avg Glucose, Stability, TIR, TITR) with trend analysis above the AGP chart in `JournalPage`, backed by server-side calculation, Zod-validated storage, and strict type safety.

## Invariants (do not change)

1.  **Location**: Scorecards must appear **above** the `ChartAnalysisCard` in `JournalPage.tsx`.
2.  **Data Source**: All metrics must be calculated on the backend during journal generation and stored in the database.
3.  **Stability Definition**: Stability is defined as the percentage of time where the rate of change (ROC) is < 1.5 mg/dL/min.
4.  **Trend Logic**: Trends are **signed deltas** (e.g., +5, -10) comparing the current week against the _immediately preceding_ journal entry.
5.  **Trend Expiry**: If the previous journal is older than **14 days**, trends must be null.
6.  **Security (PHI)**: No raw glucose data or calculation payloads may be logged to the server console or files.
7.  **Data Integrity**: All JSON data read from the database must be validated with **Zod** before use. `any` casting is strictly forbidden.
8.  **Units**: Backend stores `avgGlucose` in mg/dL. Frontend converts to mmol/L if `user.preferredUnits` requires it.

## Assumptions & Scope

- **Assumption**: `scoreCardData` will be `null` for existing journals; the UI must handle this gracefully.
- **Scope**:
  - Shared Packages: Add Zod schema and Types.
  - Backend: Database migration, calculation logic, worker integration.
  - Frontend: Components and Page integration.

## Objectives

1.  Display 4 key metrics with correct nautical branding.
2.  Show trend indicators with correct **Direction** (Arrow) and **Sentiment** (Color).
3.  Ensure 100% test coverage for calculation logic, including edge cases (`NaN`, `Infinity`).
4.  Zero runtime crashes due to malformed JSON data in the worker.

## Risks & Mitigations

- **Risk**: "Stability" calculation noisy due to gaps.
  - **Mitigation**: Calculate ROC only between consecutive readings (≤ 15 mins apart).
- **Risk**: Malformed data in "Previous Journal" crashing the worker.
  - **Mitigation**: Use `z.safeParse()` on previous journal data. If invalid, treat as "no previous journal" (null trends).
- **Risk**: `NaN` or `Infinity` propagating to UI.
  - **Mitigation**: Implement a `safeRound` helper in the backend to force finite numbers or default to 0.

## Method Outline

1.  **Shared Definitions**: Define Zod schema in `@goodnumbers/schemas` and TypeScript interfaces in `@goodnumbers/types`.
2.  **Schema Update**: Add `scoreCardData` JSON field to `Journal` model.
3.  **Backend TDD**: Implement `calculateScoreCardMetrics` with safe math helpers.
4.  **Worker Integration**: Integrate calculation with Zod validation and PHI-safe error handling.
5.  **Frontend TDD**: Implement `MetricScorecard` handling direction/color logic.

## Implementation Notes

- **Trend Colors**:
  - **Avg Glucose**: Negative delta = Green (Improvement), Positive delta = Amber (Worsening).
  - **Others**: Positive delta = Green, Negative delta = Amber.
  - **Zero**: Gray/Neutral (`–`).
- **Icons**: `Compass` (Avg), `Waves` (Stability), `Ship` (TIR), `Palmtree` (TITR).
- **Safe Math**:
  ```typescript
  function safeRound(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value);
  }
  ```

## Acceptance Gates

- [ ] **Schema**: `scoreCardData` column exists.
- [ ] **Type Safety**: Zod schema used for all JSON parsing.
- [ ] **Backend**: `calculateScoreCardMetrics` returns signed deltas and handles empty/malformed inputs safely.
- [ ] **Frontend**: Avg Glucose trend "-10" shows as **Green ↓ 10**.
- [ ] **Frontend**: TIR trend "+10" shows as **Green ↑ 10**.
- [ ] **Frontend**: Mobile view scrolls horizontally.

## “Make-sure-you” Checklist

- [ ] Run `npm run build -w @goodnumbers/schemas` after defining the schema.
- [ ] Run `npx prisma generate` after schema changes.
- [ ] Verify `timeInTightRange` uses 70-140 mg/dL.
- [ ] Verify `timeInRange` uses 70-180 mg/dL.

## Project hygiene prep

- **Branch**: `feat/voyager-scorecards`
- **Issue**: Create GitHub issue "Implement Voyager Scorecards".

---

## In-depth Test & Engineering Plan

### Phase 1: Shared Definitions & Schema

#### Step 1: Define Shared Types & Schema

**Action**: Update `packages/schemas/src/index.ts`.

```typescript
import { z } from "zod";

export const ScoreCardTrendSchema = z.object({
  value: z.number(),
  isPositive: z.boolean(), // Kept for legacy compatibility if needed, but we primarily use signed value now
});

export const ScoreCardDataSchema = z.object({
  avgGlucose: z.number(),
  stability: z.number(),
  timeInRange: z.number(),
  timeInTightRange: z.number(),
  trends: z
    .object({
      avgGlucose: z.number(), // Signed delta
      stability: z.number(),
      timeInRange: z.number(),
      timeInTightRange: z.number(),
    })
    .nullable()
    .optional(),
});

export type ScoreCardData = z.infer<typeof ScoreCardDataSchema>;
```

**Action**: Build the package: `npm run build -w @goodnumbers/schemas`.

#### Step 2: Database Schema Update

**Action**: Update `backend/prisma/schema.prisma`.

```prisma
model Journal {
  // ... existing fields
  scoreCardData Json? // Stores ScoreCardData
}
```

**Action**: `npx prisma migrate dev --name add_scorecard_data`

---

### Phase 2: Backend Implementation (TDD)

#### Step 3: Backend Unit Tests (RED)

**Action**: Create `backend/tests/unit/scorecard.test.ts`.

```typescript
import { describe, it, expect } from "vitest";
import { calculateMetrics, calculateTrends } from "../../src/lib/scorecard";
import { GlucoseEntry } from "@goodnumbers/types";

describe("Scorecard Logic", () => {
  describe("calculateMetrics", () => {
    it("should return zeros for empty data", () => {
      const result = calculateMetrics([]);
      expect(result).toEqual({
        avgGlucose: 0,
        stability: 0,
        timeInRange: 0,
        timeInTightRange: 0,
      });
    });

    it("should handle division by zero/NaN gracefully", () => {
      // Mock data that might cause issues if not handled
      const entries = [{ sgv: NaN, dateString: "..." }] as any;
      const result = calculateMetrics(entries);
      expect(result.avgGlucose).toBe(0); // Should be 0, not NaN
    });

    it("should calculate stability correctly (ROC < 1.5)", () => {
      const entries = [
        { sgv: 100, dateString: "2023-01-01T10:00:00Z" },
        { sgv: 105, dateString: "2023-01-01T10:05:00Z" }, // Stable
        { sgv: 120, dateString: "2023-01-01T10:10:00Z" }, // Unstable
      ] as GlucoseEntry[];
      const result = calculateMetrics(entries);
      expect(result.stability).toBe(50);
    });
  });

  describe("calculateTrends", () => {
    const current = {
      avgGlucose: 140,
      stability: 60,
      timeInRange: 80,
      timeInTightRange: 50,
    };
    const prev = {
      avgGlucose: 150,
      stability: 50,
      timeInRange: 70,
      timeInTightRange: 40,
    };

    it("should return signed deltas", () => {
      const trends = calculateTrends(current, prev);
      expect(trends?.avgGlucose).toBe(-10); // 140 - 150
      expect(trends?.stability).toBe(10); // 60 - 50
    });

    it("should return null if previous data is missing", () => {
      expect(calculateTrends(current, null)).toBeNull();
    });
  });
});
```

#### Step 4: Backend Implementation (GREEN)

**Action**: Create `backend/src/lib/scorecard.ts`.

```typescript
import { GlucoseEntry } from "@goodnumbers/types";
import { ScoreCardData } from "@goodnumbers/schemas";

function safeRound(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function calculateMetrics(
  entries: GlucoseEntry[],
): Omit<ScoreCardData, "trends"> {
  if (!entries.length)
    return { avgGlucose: 0, stability: 0, timeInRange: 0, timeInTightRange: 0 };

  // Filter out invalid SGVs immediately
  const validEntries = entries.filter((e) => Number.isFinite(e.sgv));
  if (!validEntries.length)
    return { avgGlucose: 0, stability: 0, timeInRange: 0, timeInTightRange: 0 };

  const total = validEntries.length;
  const sum = validEntries.reduce((acc, e) => acc + e.sgv, 0);
  const inRange = validEntries.filter(
    (e) => e.sgv >= 70 && e.sgv <= 180,
  ).length;
  const tight = validEntries.filter((e) => e.sgv >= 70 && e.sgv <= 140).length;

  let stableIntervals = 0;
  let totalIntervals = 0;

  const sorted = [...validEntries].sort(
    (a, b) =>
      new Date(a.dateString).getTime() - new Date(b.dateString).getTime(),
  );

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];
    const timeDiffMin =
      (new Date(curr.dateString).getTime() -
        new Date(prev.dateString).getTime()) /
      60000;

    if (timeDiffMin > 0 && timeDiffMin <= 15) {
      const roc = Math.abs(curr.sgv - prev.sgv) / timeDiffMin;
      if (roc < 1.5) stableIntervals++;
      totalIntervals++;
    }
  }

  return {
    avgGlucose: safeRound(sum / total),
    timeInRange: safeRound((inRange / total) * 100),
    timeInTightRange: safeRound((tight / total) * 100),
    stability:
      totalIntervals > 0
        ? safeRound((stableIntervals / totalIntervals) * 100)
        : 0,
  };
}

export function calculateTrends(
  current: Omit<ScoreCardData, "trends">,
  previous: Omit<ScoreCardData, "trends"> | null,
) {
  if (!previous) return null;
  return {
    avgGlucose: safeRound(current.avgGlucose - previous.avgGlucose),
    stability: safeRound(current.stability - previous.stability),
    timeInRange: safeRound(current.timeInRange - previous.timeInRange),
    timeInTightRange: safeRound(
      current.timeInTightRange - previous.timeInTightRange,
    ),
  };
}
```

#### Step 5: Worker Integration (Secure)

**Action**: Modify `backend/src/worker/journalProcessor.ts`.

```typescript
import { calculateMetrics, calculateTrends } from "../lib/scorecard";
import { ScoreCardDataSchema } from "@goodnumbers/schemas";

// ... inside processing function ...

// 1. Calculate securely
let scoreCardMetrics;
try {
  scoreCardMetrics = calculateMetrics(glucoseData);
} catch (error) {
  console.error(
    `Failed to calculate metrics for Journal ${job.data.journalId}. Error: ${(error as Error).message}`,
  );
  // Do NOT log 'glucoseData'
  scoreCardMetrics = {
    avgGlucose: 0,
    stability: 0,
    timeInRange: 0,
    timeInTightRange: 0,
  };
}

// 2. Fetch Previous Journal
const previousJournal = await prisma.journal.findFirst({
  where: {
    userId: job.data.userId, // Trusted from job payload
    status: "COMPLETE",
    createdAt: { lt: new Date(job.data.createdAt) },
  },
  orderBy: { createdAt: "desc" },
});

let trends = null;

if (previousJournal && previousJournal.scoreCardData) {
  // 3. Validate Previous Data with Zod (Safety Check)
  const parseResult = ScoreCardDataSchema.safeParse(
    previousJournal.scoreCardData,
  );

  if (parseResult.success) {
    const prevData = parseResult.data;
    const fourteenDaysAgo = new Date(
      new Date(job.data.createdAt).getTime() - 14 * 24 * 60 * 60 * 1000,
    );

    if (previousJournal.createdAt >= fourteenDaysAgo) {
      trends = calculateTrends(scoreCardMetrics, prevData);
    }
  } else {
    console.warn(
      `Invalid ScoreCardData in previous journal ${previousJournal.id}. Skipping trends.`,
    );
  }
}

// 4. Save
const scoreCardData = { ...scoreCardMetrics, trends };
// ... update prisma ...
```

---

### Phase 3: Frontend Implementation (TDD)

#### Step 6: Component Tests (RED)

**Action**: Create `frontend/src/components/journal/__tests__/MetricScorecard.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MetricScorecard from "../MetricScorecard";
import { Compass } from "lucide-react";

describe("MetricScorecard", () => {
  it("renders Avg Glucose improvement (Drop) correctly", () => {
    // Drop (-10) is GOOD (Green)
    render(
      <MetricScorecard
        label="Avg Glucose"
        value="140"
        icon={Compass}
        colorClass="bg-slate-600"
        trend={-10}
        inverseTrend={true}
      />,
    );
    const trendEl = screen.getByText("↓ 10");
    expect(trendEl.className).toContain("text-green-600");
  });

  it("renders TIR improvement (Rise) correctly", () => {
    // Rise (+10) is GOOD (Green)
    render(
      <MetricScorecard
        label="TIR"
        value="80"
        icon={Compass}
        colorClass="bg-emerald-600"
        trend={10}
        inverseTrend={false}
      />,
    );
    const trendEl = screen.getByText("↑ 10");
    expect(trendEl.className).toContain("text-green-600");
  });

  it("renders neutral trend correctly", () => {
    render(
      <MetricScorecard
        label="TIR"
        value="80"
        icon={Compass}
        colorClass="bg-emerald-600"
        trend={0}
      />,
    );
    expect(screen.getByText("–")).toBeDefined();
  });
});
```

#### Step 7: Component Implementation (GREEN)

**Action**: Create `frontend/src/components/journal/MetricScorecard.tsx`.

```tsx
import React from "react";
import {
  LucideIcon,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

interface MetricScorecardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  colorClass: string;
  percentage?: number;
  tooltip?: string;
  trend?: number | null; // Signed delta
  inverseTrend?: boolean; // If true, negative trend = Green (Good)
}

export default function MetricScorecard({
  label,
  value,
  unit,
  icon: Icon,
  colorClass,
  percentage,
  tooltip,
  trend,
  inverseTrend = false,
}: MetricScorecardProps) {
  let TrendIcon = Minus;
  let trendColor = "text-gray-400";
  const absTrend = trend ? Math.abs(trend) : 0;

  if (trend !== undefined && trend !== null && trend !== 0) {
    if (trend > 0) {
      TrendIcon = ArrowUp;
      trendColor = inverseTrend ? "text-amber-600" : "text-green-600";
    } else {
      TrendIcon = ArrowDown;
      trendColor = inverseTrend ? "text-green-600" : "text-amber-600";
    }
  }

  return (
    <div className="relative flex flex-col p-4 rounded-xl border border-gray-100 bg-white min-w-[160px] flex-1 shadow-sm hover:border-gray-200 transition-colors group">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${colorClass.replace("bg-", "text-")}`} />
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`text-xs font-bold flex items-center gap-0.5 ${trend === 0 ? "text-gray-400" : trendColor}`}
          >
            {trend === 0 ? (
              <Minus className="w-3 h-3" />
            ) : (
              <TrendIcon className="w-3 h-3" />
            )}
            {trend !== 0 && absTrend}
          </div>
        )}
      </div>
      {/* Label, Tooltip, Value, Progress Bar implementation ... */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </span>
        {tooltip && <HelpCircle className="w-3 h-3 text-gray-300" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {unit && (
          <span className="text-sm text-gray-500 font-medium">{unit}</span>
        )}
      </div>
      {percentage !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100 rounded-b-xl overflow-hidden">
          <div
            className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

**Action**: Create `frontend/src/components/journal/ScorecardRow.tsx`.

- Import `ScoreCardData` from `@goodnumbers/schemas` (via shared types).
- Use `inverseTrend={true}` for Avg Glucose.
- Implement horizontal scroll hiding.

#### Step 8: Page Integration

**Action**: Update `frontend/src/pages/JournalPage.tsx`.

- Import `ScorecardRow`.
- Add `scoreCardData` to `JournalResponse` type (using `ScoreCardData` from shared types).
- Render `<ScorecardRow>` above `<ChartAnalysisCard>`.
