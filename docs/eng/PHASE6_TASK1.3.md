# {{HOTSPOT_ENGINE}} — `todo.md`

## TL;DR

Implement an atomic, timezone-aware backend engine to detect recurring glycemic patterns using an **Event-First TDD approach**: detect clinical episodes first, then cluster them by time-of-day overlap, ensuring raw timeseries data is persisted for visualization.

## Invariants (do not change)

- **Timezone Truth:** All time-of-day calculations must use the user's local timezone (derived from Nightscout Profile) using `luxon`. UTC must never be used for pattern detection.
- **Atomicity:** The deletion of old clusters and creation of new ones must happen within a single **Prisma Transaction** to prevent data loss or corruption.
- **Privacy (PHI):** No glucose values, timestamps, or cluster details may be logged to the server console or files. Log only counts (e.g., "Found 3 clusters").
- **Data Integrity:** The `GlycemicCluster` object must contain the raw `GlycemicEvent` data (timeseries) to enable frontend visualization without re-fetching.
- **Clinical Thresholds:** Hardcoded to **70 mg/dL** (Hypo) and **180 mg/dL** (Hyper).
- **Minimum Duration:** A pattern must persist for at least **20 minutes** to be classified as an event.

## Assumptions & Scope

- **Assumption:** The `luxon` library correctly handles Daylight Saving Time (DST) transitions when mapping UTC timestamps to local time-of-day minutes.
- **Assumption:** Input `entries` array size is manageable in memory but potentially unsorted and dirty.
- **Scope:**
  - Installation of `luxon` and `fast-check` (for property-based testing).
  - Definition of Zod schemas and TypeScript interfaces in shared packages.
  - Implementation of `HotspotDetector` class via strict TDD cycles.
  - Integration into `worker.ts`.
- **Out of Scope:** Frontend visualization components.

## Objectives

1.  **Correctness:** 100% pass rate on property-based tests for midnight wraparound and overlap logic.
2.  **Resilience:** Gracefully handle and filter malformed inputs (NaN, infinite values) without crashing.
3.  **Performance:** Process 5,000 input entries in under 200ms on standard hardware.
4.  **Completeness:** Persist fully hydrated cluster objects capable of driving the frontend chart.

## Risks & Mitigations

- **Risk:** **Midnight Wraparound Bugs.** Logic failing to connect an event ending at 23:55 with one starting at 00:05.
  - **Mitigation:** Use **Property-Based Testing** (`fast-check`) to generate thousands of random time intervals crossing midnight to verify connectivity invariants.
- **Risk:** **DoS via Large Payload.** Processing extremely large arrays causes OOM.
  - **Mitigation:** Enforce a hard cap of 5,000 entries at the API/Service boundary.
- **Risk:** **Timezone Injection.** Invalid timezone strings causing `luxon` failures.
  - **Mitigation:** Strict validation of timezone strings against IANA database; fallback to UTC with warning log.

## Method Outline

### 1. Event Detection (The "Scanner")

- **Mechanism:** Iterate chronologically through sanitized `entries`.
- **Logic:** Identify contiguous sequences where `sgv > 180` or `sgv < 70`.
- **Filter:** Discard sequences where `duration < 20 minutes`.
- **Output:** `GlycemicEvent[]` containing start/end times and the raw `readings` array.

### 2. Normalization & Clustering (The "Matcher")

- **Mechanism:** Map events to a generic 24-hour cycle (minutes 0–1439).
- **Logic:** Construct a graph where nodes are `GlycemicEvents`. Edges exist if time-of-day intervals overlap (handling midnight wrap).
- **Algorithm:** Find Connected Components (DFS/BFS). Each component is a `GlycemicCluster`.
- **Trade-off:** $O(N^2)$ comparison is acceptable for $N < 100$ events per week.

### 3. Filtering

- **Mechanism:** Count distinct ISO weekdays in each cluster.
- **Rule:** Keep cluster only if `distinct_days >= 3`.

## Implementation Notes

### Shared Schemas (`packages/schemas/src/index.ts`)

```typescript
import { z } from "zod";

const GlucoseReadingSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
});

export const GlycemicEventSchema = z.object({
  id: z.string(),
  type: z.enum(["hyper", "hypo"]),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  startMinuteOfDay: z.number().min(0).max(1439),
  durationMinutes: z.number().positive(),
  readings: z.array(GlucoseReadingSchema),
});

export const GlycemicClusterSchema = z
  .object({
    id: z.string(),
    type: z.enum(["hyper", "hypo"]),
    avgStartMinute: z.number().min(0).max(1439),
    avgDurationMinutes: z.number().positive(),
    eventCount: z.number().int().positive(),
    activeDays: z.array(z.number().min(1).max(7)), // 1=Mon, 7=Sun
    events: z.array(GlycemicEventSchema),
  })
  .strict();
```

## Acceptance Gates

1.  **Security:** Inputting 10,000 entries results in exactly 5,000 processed.
2.  **Correctness:** Property tests confirm that shifting an entire dataset by 12 hours shifts the detected clusters by 12 hours (modulo 24).
3.  **Logic:** A cluster is correctly identified across the midnight boundary (e.g., 23:50 to 00:20).
4.  **Privacy:** No PHI in stdout.

## “Make-sure-you” Checklist

- [ ] **Security:** Wrap DB operations in `prisma.$transaction`.
- [ ] **Security:** Limit input array to 5,000 items.
- [ ] **Reliability:** Validate `DateTime.fromISO().setZone(tz).isValid`.
- [ ] **Testing:** Implement at least one property-based test for overlap logic.
- [ ] **Data:** Ensure `clusterDataJson` includes the `readings` array.

## Project hygiene prep

1.  **Branch:** `feat/phase6-task1.3-hotspot-engine`
2.  **Issue:** `gh issue create --title "feat(analysis): P6_T1.3 Implement Event-First Hotspot Engine" --body "Implement event detection, clustering with midnight support, and transactional persistence."`
3.  **Test Command:** `npm test -w backend`

## In-depth test plan

### 1. Unit Testing (`backend/tests/unit/HotspotDetector.test.ts`)

- **Event Detection:** Verify correct identification of High/Low sequences and `minDuration` filtering.
- **Normalization:** Verify UTC to Local Minute conversion, including DST edge cases if possible.

### 2. Property-Based Testing (using `fast-check`)

- **Invariant: Midnight Continuity.**
  - _Property:_ An event starting at $23:55$ and ending at $00:10$ must overlap with an event starting at $23:50$ and ending at $00:05$.
- **Invariant: Idempotency.**
  - _Property:_ Running the detector twice on the same data yields identical results.

## In-depth engineering plan

### Step 1: Foundation & Dependencies

**Goal:** Set up the environment and shared types.

1.  **Install Dependencies:**
    ```bash
    npm install luxon -w backend
    npm install @types/luxon fast-check --save-dev -w backend
    ```
2.  **Implement Schemas:** Copy the Zod schemas from the "Implementation Notes" section into `packages/schemas/src/index.ts`.
3.  **Export Types:** In `packages/types/src/index.ts`:
    ```typescript
    import { z } from "zod";
    import {
      GlycemicEventSchema,
      GlycemicClusterSchema,
    } from "@goodnumbers/schemas";
    export type GlycemicEvent = z.infer<typeof GlycemicEventSchema>;
    export type GlycemicCluster = z.infer<typeof GlycemicClusterSchema>;
    ```
4.  **Build Packages:** `npm run build -w @goodnumbers/schemas && npm run build -w @goodnumbers/types`

### Step 2: Implement `HotspotDetector` (Strict TDD)

#### Cycle 1: Basic Event Detection

1.  **Red:** Create `backend/tests/unit/HotspotDetector.test.ts`. Add a test case with a known sequence of 5 high readings (e.g., 200 mg/dL for 25 mins). Assert `detectEvents` returns 1 event with correct start/end times and 5 raw readings.
2.  **Green:** Create `HotspotDetector.ts`. Implement `detectEvents` to iterate through entries, tracking contiguous sequences > threshold, and pushing to an array.
3.  **Refactor:** Ensure the loop handles the end of the array correctly (flushing the last sequence).

#### Cycle 2: Minimum Duration Filter

1.  **Red:** Add a test case with a "spike" (high for 10 minutes, then normal). Assert `detectEvents` returns 0 events.
2.  **Green:** Update `detectEvents` to calculate duration (`endTime - startTime`) and only push if `>= MIN_DURATION_MINUTES` (20).
3.  **Refactor:** Extract `MIN_DURATION_MINUTES` to a constant.

#### Cycle 3: Normalization & Overlap Logic (The Graph Edges)

1.  **Red:** Add a test case for `doEventsOverlap`.
    - Event A: 14:00 - 15:00.
    - Event B: 14:30 - 15:30.
    - Assert `true`.
    - Event C: 16:00 - 17:00.
    - Assert `false` against A and B.
2.  **Green:** Implement `doEventsOverlap`. Convert times to minute-of-day (0-1439). Check interval intersection with a small buffer (e.g., 15 mins).
3.  **Refactor:** Create a helper `getNormalizedIntervals(event)` to handle the minute conversion cleanly.

#### Cycle 4: Midnight Wraparound (Critical)

1.  **Red:** Add a Property Test using `fast-check`.
    ```typescript
    test("Property: Overlap handles midnight wrapping", () => {
      fc.assert(
        fc.property(fc.nat(1439), fc.nat(120), (start) => {
          // Create event crossing midnight (e.g., start 1430, duration 30 -> wraps to 20)
          // Assert it overlaps with itself shifted by 0 minutes
        })
      );
    });
    ```

    - _Specific Case:_ Event A (23:45 - 00:15) vs Event B (23:50 - 00:20). Assert `true`.
2.  **Green:** Update `getNormalizedIntervals` to return _two_ intervals if the event wraps around (e.g., `[1425, 1440]` and `[0, 15]`). Update `doEventsOverlap` to check all combinations.
3.  **Refactor:** Simplify the interval logic.

#### Cycle 5: Clustering & Frequency Filter

1.  **Red:** Add a test with 3 events:
    - Mon 14:00 (High)
    - Tue 14:15 (High)
    - Wed 14:10 (High)
    - Thu 18:00 (High - Unrelated)
    - Assert `findClusters` returns 1 cluster (containing Mon, Tue, Wed) and ignores Thu (count < 3 if threshold applied).
2.  **Green:** Implement `findClusters` using a Graph traversal (DFS/BFS).
    - Build adjacency list using `doEventsOverlap`.
    - Find connected components.
    - Filter components where `distinctDays < 3`.
3.  **Refactor:** Ensure the final `GlycemicCluster` object is fully populated with `avgStartMinute`, `events` array, etc.

### Step 3: Integration (Worker)

**Goal:** Persist the results atomically.

1.  **Modify `backend/src/worker.ts`:**

    ```typescript
    // Inside the job processor
    const detector = new HotspotDetector(user.timezone);

    // 1. Detect
    const hyperEvents = detector.detectEvents(entries, "hyper", 180);
    const hypoEvents = detector.detectEvents(entries, "hypo", 70);

    // 2. Cluster
    const hyperClusters = detector.findClusters(hyperEvents);
    const hypoClusters = detector.findClusters(hypoEvents);
    const allClusters = [...hyperClusters, ...hypoClusters];

    // 3. Persist (Atomic Transaction)
    await prisma.$transaction([
      prisma.glycemicEventCluster.deleteMany({ where: { journalId } }),
      prisma.glycemicEventCluster.createMany({
        data: allClusters.map((c) => ({
          journalId,
          eventType: c.type,
          eventCount: c.eventCount,
          meanTimeMinutes: c.avgStartMinute,
          // THE KEY: Saving the full object with raw readings
          clusterDataJson: c as unknown as Prisma.InputJsonValue,
        })),
      }),
    ]);
    ```
