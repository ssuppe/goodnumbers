# Goodnumbers — PHASE6_TASK2.hypo.md

## TL;DR

Implement loop-aware hypoglycemia heuristics using velocity (Rate of Change) and treatment presence to classify low blood sugar events into actionable clinical buckets, bypassing brittle kinetic math in favor of a robust, deterministic TDD approach.

## Invariants (do not change)

1. **Deterministic Math**: The engine must use pure TypeScript math based on timestamps and glucose values. No external APIs or LLMs in this heuristic generation layer.
2. **Loop-Awareness**: The logic must accommodate Automated Insulin Delivery (AID) systems by checking for the _presence_ of insulin (including tiny SMBs) rather than absolute volume thresholds.
3. **Hierarchy of Truth**: Event categorization must follow a strict `if / else if` hierarchy to prevent multiple conflicting insights for a single event.
4. **Privacy (PHI)**: Do not log specific glucose values, timestamps, or raw treatment data to the server console.

## Assumptions & Scope

- **Assumption**: `cluster.events[i].readings` contains a 3-hour buffer of glucose data _prior_ to the event start time, as implemented by the `HotspotDetector`.
- **Assumption**: The `treatments` array passed to `generateClusterInsights` includes SMBs (Super Micro Boluses) and manual boluses.
- **Scope**: Modifying `backend/src/lib/insights/cluster.ts` to handle the `cluster.type === 'hypo'` branch, and adding corresponding unit tests.
- **Out of Scope**: Fetching `devicestatus` from Nightscout (we rely solely on existing `treatments` and `entries`).

## Objectives

1. **Dynamic Velocity Calculation**: Accurately calculate the Rate of Change (ROC) in mg/dL per minute for the ~30-minute window preceding a hypoglycemia event, using true time deltas.
2. **Context Verification**: Verify the presence of carbohydrates (last 3 hours) and active insulin (last 2 hours).
3. **Clinical Categorization**: Bucket every low event into one of four clinical categories: Compression Low, Over-Announced Meal, Aggressive Loop, or Background Drift.
4. **TDD Verification**: Achieve 100% test coverage for the four new clinical buckets using dynamically constructed mock data arrays.

## Risks & Mitigations

- **Risk**: The 30-minute lookback window lacks data points (e.g., sensor warmup or signal loss), causing skewed ROC division.
  - **Mitigation**: Dynamically calculate the time difference `Delta T` between the two readings. If `Delta T` is less than 10 minutes, skip the ROC calculation to prevent noise.
- **Risk**: False "Compression Low" detection if ROC math is inverted.
  - **Mitigation**: Ensure ROC math strictly calculates `(OlderBG - NewerBG) / Delta_Mins`. A positive number represents a drop.
- **Risk**: Small SMBs are filtered out, blinding the engine to closed-loop insulin pressure.
  - **Mitigation**: Use `(t.insulin || 0) > 0` to flag _any_ insulin delivery, completely removing arbitrary volume minimums.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea**: Use the physical manifestation of closed-loop behavior (speed of crash and presence of treatments) instead of attempting to reverse-engineer exact IOB/COB decay curves.
- **Mechanism**:
  1. Iterate through each event in the hypo cluster.
  2. Find the glucose reading exactly at `startTime` (event trigger).
  3. Find the glucose reading closest to `startTime - 30 mins`. Calculate ROC dynamically.
  4. Check for `hasCarbs` (3-hour window) and `hasRecentInsulin` (2-hour window).
  5. Apply the strict decision tree to increment bucket counters.
  6. Generate user-friendly `Insight` objects for buckets with >0 counts.
- **Trade-offs**: Sacrifices exact pharmacokinetic modeling, but gains massive reliability across all pump types and user profiles while remaining completely deterministic.
- **Go/No-Go**: **Go**.

## Implementation Notes

- **File**: `backend/src/lib/insights/cluster.ts`
- **ROC Formula**: `(Previous_BG - Start_BG) / Delta_Minutes`.
- **Thresholds**:
  - `ROC >= 3.0` -> Compression/Sensor Error.
  - `ROC >= 1.5` -> Steep drop (Aggressive crash).
- **Time Windows**:
  - ROC Lookback Target: `30` minutes before `startTime`.
  - Insulin Lookback: `120` minutes (2 hours) before `startTime`.
  - Carb Lookback: `180` minutes (3 hours) before `startTime`.

## Acceptance Gates

- [ ] Unit tests pass for all four heuristic buckets independently.
- [ ] The "Compression Low" bucket correctly trumps the "Carb Mismatch" bucket if both conditions are met.
- [ ] No code throws errors if `readings` arrays are sparse or empty.
- [ ] Output notes contain specific counts (e.g., "2 of these lows...").

## “Make-sure-you” Checklist

- [ ] Remove the `// TODO: Implement hypo-specific heuristics if needed` comment in `cluster.ts`.
- [ ] Ensure time differences are calculated using `.getTime()` to get milliseconds, then divided by `60000` to get minutes.
- [ ] Check that `priorReading.timestamp !== startReading.timestamp` before dividing to prevent division by zero.

## Project hygiene prep

1. **Branch Setup**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/phase6-task2-hypo-heuristics
   ```
2. **Issue Creation**:
   ```bash
   gh issue create --title "feat(insights): P6_T2 Implement loop-aware Hypo Heuristics" --body "Implement velocity and treatment presence heuristics for low blood sugar clusters using TDD."
   ```
3. **TDD Workflow**: Follow Red-Green-Refactor. Use `npm run test:backend:ai` to run tests rapidly.

## In-depth test plan

### 1. Write the Unit Tests (RED)

Create `backend/tests/unit/insights/cluster_hypo.test.ts`.

```typescript
// file: backend/tests/unit/insights/cluster_hypo.test.ts
import { describe, it, expect } from "vitest";
import { generateClusterInsights } from "@src/lib/insights/cluster";
import {
  InsightPriority,
  type GlycemicCluster,
  type GlycemicEvent,
} from "@goodnumbers/types";

describe("Cluster Hypoglycemia Kinetic Insights", () => {
  const baseEvent: GlycemicEvent = {
    id: "e1",
    type: "hypo",
    startTime: "2023-01-01T12:00:00Z",
    endTime: "2023-01-01T12:30:00Z",
    startMinuteOfDay: 720,
    durationMinutes: 30,
    readings: [],
  };

  const createReadings = (
    startVal: number,
    endVal: number,
    minsAgo: number = 30,
  ) => {
    const startTime = new Date("2023-01-01T12:00:00Z").getTime();
    return [
      {
        timestamp: new Date(startTime - minsAgo * 60000).toISOString(),
        value: startVal,
      },
      { timestamp: new Date(startTime).toISOString(), value: endVal },
    ];
  };

  it("detects Compression Lows (ROC >= 3.0)", () => {
    // 160 to 60 in 20 mins (dirty data) = 100 / 20 = 5.0 mg/dL/min
    const cluster = {
      ...baseEvent,
      events: [{ ...baseEvent, readings: createReadings(160, 60, 20) }],
    } as GlycemicCluster;
    const insights = generateClusterInsights(cluster, []);

    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.INFO,
        note: expect.stringContaining("sudden, vertical drop"),
      }),
    );
  });

  it("prioritizes Compression Low over Carb Mismatch", () => {
    // Huge drop (compression), but carbs are present. Should STILL be compression.
    const cluster = {
      ...baseEvent,
      events: [{ ...baseEvent, readings: createReadings(160, 60, 15) }],
    } as GlycemicCluster;
    const treatments = [
      { date: new Date("2023-01-01T10:00:00Z").getTime(), carbs: 40 },
    ];
    const insights = generateClusterInsights(cluster, treatments);

    expect(insights).toHaveLength(1);
    expect(insights[0].note).toContain("sudden, vertical drop");
  });

  it("detects Over-Announced Meals (Carbs present in last 3h)", () => {
    // 100 to 60 in 30 mins = 1.33 mg/dL/min (Not a compression, not a crash)
    const cluster = {
      ...baseEvent,
      events: [{ ...baseEvent, readings: createReadings(100, 60, 30) }],
    } as GlycemicCluster;
    const treatments = [
      { date: new Date("2023-01-01T10:00:00Z").getTime(), carbs: 40 },
    ];

    const insights = generateClusterInsights(cluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining("shortly after announcing carbs"),
      }),
    );
  });

  it("detects Aggressive Loop / High Pressure (ROC >= 1.5 + ANY recent insulin)", () => {
    // 120 to 60 in 30 mins = 2.0 mg/dL/min
    const cluster = {
      ...baseEvent,
      events: [{ ...baseEvent, readings: createReadings(120, 60, 30) }],
    } as GlycemicCluster;
    // Even a tiny 0.05U SMB triggers the context
    const treatments = [
      { date: new Date("2023-01-01T11:00:00Z").getTime(), insulin: 0.05 },
    ];

    const insights = generateClusterInsights(cluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining(
          "steep drop and follow periods where your system delivered insulin",
        ),
      }),
    );
  });

  it("detects Basal/Sensitivity Drift (Slow ROC + No Carbs)", () => {
    // 90 to 60 in 30 mins = 1.0 mg/dL/min
    const cluster = {
      ...baseEvent,
      events: [{ ...baseEvent, readings: createReadings(90, 60, 30) }],
    } as GlycemicCluster;
    const treatments = [
      { date: new Date("2023-01-01T08:00:00Z").getTime(), insulin: 1.0 },
    ]; // Outside 2h window

    const insights = generateClusterInsights(cluster, treatments);
    expect(insights).toContainEqual(
      expect.objectContaining({
        priority: InsightPriority.IMPORTANT,
        note: expect.stringContaining("slow, drifting lows"),
      }),
    );
  });
});
```

Run `npm run test:backend:ai` to verify these tests **fail**.

## In-depth engineering plan

### 2. Implement the Heuristics (GREEN)

Modify `backend/src/lib/insights/cluster.ts`. Replace the `if (cluster.type === 'hypo')` placeholder with the following logic:

```typescript
// Inside backend/src/lib/insights/cluster.ts

if (cluster.type === "hypo") {
  let compressionCount = 0;
  let carbMismatchCount = 0;
  let aggressiveCrashCount = 0;
  let driftCount = 0;

  cluster.events.forEach((event) => {
    const eventTime = new Date(event.startTime).getTime();

    // 1. DYNAMIC VELOCITY (ROC) CALCULATION
    let roc = 0;
    if (event.readings && event.readings.length > 0) {
      // Sort readings chronologically just in case
      const sortedReadings = [...event.readings].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      // Find the reading exactly at or immediately before the event trigger
      const startReading = sortedReadings
        .filter((r) => new Date(r.timestamp).getTime() <= eventTime)
        .pop();

      if (startReading) {
        // Target 30 mins ago
        const targetLookback = eventTime - 30 * 60000;
        let priorReading = sortedReadings[0];
        let minDiff = Infinity;

        // Find the reading CLOSEST to t-30
        for (const r of sortedReadings) {
          const rTime = new Date(r.timestamp).getTime();
          if (rTime >= new Date(startReading.timestamp).getTime()) continue; // Ignore readings after start
          const diff = Math.abs(rTime - targetLookback);
          if (diff < minDiff) {
            minDiff = diff;
            priorReading = r;
          }
        }

        // Calculate ROC only if we have a valid time gap (at least 10 mins to avoid noise)
        if (priorReading && priorReading.timestamp !== startReading.timestamp) {
          const t1 = new Date(priorReading.timestamp).getTime();
          const t2 = new Date(startReading.timestamp).getTime();
          const deltaMins = (t2 - t1) / 60000;

          if (deltaMins >= 10) {
            // Positive ROC means dropping
            roc = (priorReading.value - startReading.value) / deltaMins;
          }
        }
      }
    }

    // 2. TREATMENT CONTEXT VERIFICATION
    const lookback3h = eventTime - 180 * 60000;
    const lookback2h = eventTime - 120 * 60000;

    const recentTreatments = treatments.filter(
      (t) => t.date >= lookback3h && t.date <= eventTime,
    );

    // Check for carbs in last 3 hours
    const hasCarbs = recentTreatments.some((t) => (t.carbs || 0) > 0);

    // Check for ANY insulin delivery (manual or tiny SMB) in the last 2 hours
    const hasRecentInsulin = recentTreatments.some(
      (t) => t.date >= lookback2h && (t.insulin || 0) > 0,
    );

    // 3. STRICT CLINICAL HIERARCHY
    if (roc >= 3.0) {
      // Impossible physiology -> Sensor compression / artifact
      compressionCount++;
    } else if (hasCarbs) {
      // Carbs entered but still went low -> Meal mismatch
      carbMismatchCount++;
    } else if (roc >= 1.5 && hasRecentInsulin) {
      // Fast crash + ANY insulin activity -> Aggressive loop/correction
      aggressiveCrashCount++;
    } else {
      // Slow drift or completely empty system -> Basal/Sens drift
      driftCount++;
    }
  });

  // 4. INSIGHT GENERATION
  if (compressionCount > 0) {
    insights.push({
      priority: InsightPriority.INFO,
      note: `Compression Lows: ${compressionCount} of these events show a sudden, vertical drop that usually indicates a sensor error or sleeping on the sensor, rather than a true low.`,
    });
  }

  if (carbMismatchCount > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Over-Announced Meals: ${carbMismatchCount} of these lows happened shortly after announcing carbs. Your system delivered insulin for the food, but your blood sugar dropped. Did you eat less than entered, or eat a high-fat/protein meal that absorbed slowly?`,
    });
  }

  if (aggressiveCrashCount > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `High Insulin Pressure: ${aggressiveCrashCount} of these lows feature a steep drop and follow periods where your system delivered insulin (via micro-boluses or corrections). The insulin may have been too aggressive.`,
    });
  }

  if (driftCount > 0) {
    insights.push({
      priority: InsightPriority.IMPORTANT,
      note: `Background Drifts: ${driftCount} of these are slow, drifting lows that happen when you have very little active insulin and haven't eaten recently. If these happen overnight or after exercise, your baseline sensitivity might have increased.`,
    });
  }

  return insights;
}
```

### 3. Verify and Commit (REFACTOR)

1. Run `npm run test:backend:ai`. All tests should pass.
2. Review code for any remaining `console.log` statements that might leak PHI; ensure none are present.
3. Commit changes:
   ```bash
   git add backend/src/lib/insights/cluster.ts backend/tests/unit/insights/cluster_hypo.test.ts
   git commit -m "feat(insights): P6_T2 implement loop-aware hypo heuristics"
   ```
