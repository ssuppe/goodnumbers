Yes, the previous plan had a high-level "Red-Green" step, but to **closely** follow TDD best practices, we should break the implementation down into granular cycles. Instead of writing *all* tests at once and then *all* code at once, we will iterate through the logic layer by layer.

Here is the finalized, strict TDD version of the engineering plan.

***

# {{VOYAGER_HOTSPOT_ENGINE}} — `todo.md`

## TL;DR
Implement the backend "Hotspot Engine" to detect recurring patterns of highs/lows using a **Sliding Window** algorithm with **Circular Merging**, storing the results as `GlycemicEventCluster` records. This implementation must be **atomic**, **DoS-resistant**, and **privacy-preserving**.

## Invariants (do not change)

*   **Timezone Truth:** All time-of-day calculations must use the user's local timezone (derived from Nightscout Profile) using `luxon`. UTC must never be used for pattern detection.
*   **Atomicity:** The deletion of old clusters and creation of new ones must happen within a **Prisma Transaction** to prevent data loss or corruption.
*   **Privacy (PHI):** No glucose values, timestamps, or cluster details may be logged to the server console or files. Log only counts (e.g., "Found 3 clusters").
*   **Single Source of Truth:** The `GlycemicCluster` interface defined in `@goodnumbers/types` is the canonical shape. The database `GlycemicEventCluster` model is merely the storage container.
*   **Clinical Thresholds:** Hardcoded to **70 mg/dL** (Hypo) and **180 mg/dL** (Hyper).
*   **Data Integrity:** Input data must be validated via Zod. `NaN`, infinite, or biologically impossible glucose values (<20 or >1000) must be filtered out before processing.

## Assumptions & Scope

*   **Assumption:** The `luxon` library is the standard for date/time manipulation.
*   **Assumption:** The input `entries` array from Nightscout may be unsorted, contain gaps, or contain malicious payloads.
*   **Scope:**
    *   Installing `luxon` and `@types/luxon`.
    *   Defining the shared `GlycemicCluster` interface and Zod schema.
    *   Implementing the `HotspotDetector` class (Validation → Circadian Map → Scan → Linear Merge → Circular Heal).
    *   Integrating the detector into `worker.ts` with transaction safety.
*   **Out of Scope:** Natural language generation (insights), charting, or frontend display.

## Objectives

1.  **Dependencies:** Install `luxon` and `@types/luxon` in the `backend` workspace.
2.  **Types & Validation:** Define the `GlycemicCluster` interface in `@goodnumbers/types` and a strict Zod schema in `@goodnumbers/schemas`.
3.  **Core Logic (Granular TDD):** Implement `HotspotDetector` iteratively:
    *   **Cycle 1:** Input Sanitization & Timezone Handling.
    *   **Cycle 2:** Circadian Mapping (UTC to Local Minute).
    *   **Cycle 3:** Sliding Window Scan (Detection).
    *   **Cycle 4:** Smart Merge & Heal (Linear + Circular).
4.  **Integration:** Wire the detector into the background worker using `prisma.$transaction`.

## Risks & Mitigations

*   **Risk:** **Data Loss (Atomicity).** If the worker crashes after deleting old clusters but before saving new ones, the user's journal is corrupted.
    *   **Mitigation:** Use `prisma.$transaction([deleteMany, createMany])` to ensure all-or-nothing execution.
*   **Risk:** **DoS (Denial of Service).** A malicious input with 1 million entries could crash the worker (OOM).
    *   **Mitigation:** Enforce a hard limit (e.g., 5,000 entries) on the input array. Truncate or reject excess data.
*   **Risk:** **Timezone Injection.** An invalid timezone string could cause logic errors or crashes.
    *   **Mitigation:** Check `DateTime.isValid` immediately after setting the zone. Fallback to UTC if invalid and log a warning.
*   **Risk:** **Midnight Wraparound (Duplicate Clusters).**
    *   **Mitigation:** The algorithm uses a strict 0–1439 scan followed by a **Circular Heal** step that checks if the last cluster connects to the first.

## Method Outline

*   **Input Sanitization:**
    *   Limit `entries.length` <= 5000.
    *   Filter `entry.sgv`: Must be integer, 20 <= val <= 1000.
    *   Validate `timezone`: If invalid, default to 'UTC'.
*   **Phase 1: Circadian Mapping:** Convert valid entries to a `Map` of `{ minuteOfDay: 0-1439, value }`.
*   **Phase 2: Sliding Window Scan:** Slide a 30-minute window (step 15m) from minute 0 to 1439.
    *   *Criteria:* > 30% out-of-range AND ≥ 3 distinct ISO weekdays.
*   **Phase 3: Smart Merge & Heal:**
    *   **Linear:** Sort and merge overlapping/adjacent (gap ≤ 15m) windows.
    *   **Circular:** Check exactly once: If `(1440 - Last.end) + First.start <= 15`, merge `First` into `Last`.

## Implementation Notes

### 1. Shared Type & Schema
In `packages/schemas/src/index.ts`:
```typescript
export const GlycemicClusterSchema = z.object({
  type: z.enum(['hyper', 'hypo']),
  startMinute: z.number().min(0).max(1439),
  durationMinutes: z.number().positive(),
  avgGlucose: z.number(),
  confidence: z.number().min(0).max(1),
  activeDays: z.array(z.number().min(1).max(7)) // ISO Weekdays
}).strict(); // Strip unknown keys
```

In `packages/types/src/index.ts`:
```typescript
export type GlycemicCluster = z.infer<typeof GlycemicClusterSchema>;
```

### 2. Database Transaction
In `backend/src/worker.ts`:
```typescript
await prisma.$transaction([
  prisma.glycemicEventCluster.deleteMany({ where: { journalId } }),
  prisma.glycemicEventCluster.createMany({
    data: clusters.map(c => ({
      // ... fields
      clusterDataJson: c as unknown as Prisma.InputJsonValue
    }))
  })
]);
```

## Acceptance Gates

1.  **Unit Test (Security):** Inputting 10,000 entries results in only 5,000 being processed (or throws error).
2.  **Unit Test (Security):** Inputting an invalid timezone string falls back to UTC without crashing.
3.  **Unit Test (Logic):** Circular heal correctly merges a cluster ending at 23:55 with one starting at 00:05.
4.  **Integration:** The database update uses a transaction (verified via code review or mock spy).
5.  **Privacy:** Logs during execution do not contain glucose values or timestamps.

## “Make-sure-you” Checklist

- [ ] **Security:** Did you wrap the delete/create operations in a `prisma.$transaction`?
- [ ] **Security:** Did you limit the input array size (e.g., max 5000) to prevent DoS?
- [ ] **Stability:** Did you check `dt.isValid` after setting the timezone?
- [ ] **Privacy:** Did you ensure the Zod schema uses `.strict()`?
- [ ] **Privacy:** Did you verify that NO glucose values are logged to stdout?
- [ ] Did you install `luxon` and `@types/luxon`?
- [ ] Did you implement the "Circular Heal" check?

## Project hygiene prep

1.  **Branch:** `feat/phase6-task1.3-hotspot-engine`
2.  **Issue:** `gh issue create --title "feat(analysis): P6_T1.3 Implement Secure Hotspot Engine" --body "Implement sliding window detection with circular merging, transactional persistence, and strict input sanitization."`
3.  **Test Command:** `npm test -w backend`

## In-depth test plan

### Unit Testing: `backend/tests/unit/HotspotDetector.test.ts`

*   **Setup:** Helper `generateEntry(isoTime, value)`.

**Test 1: Security - Input Sanitization**
*   **Input:** Array of 6,000 entries. Some have `sgv: -100`, `sgv: 2000`. Invalid timezone "Mars".
*   **Expectation:** Detector processes exactly 5,000 entries. `sgv` values < 20 or > 1000 are ignored. Timezone defaults to UTC. No crash.

**Test 2: Logic - Circular Heal**
*   **Input:** Highs between 23:45 and 00:15.
*   **Expectation:** One `GlycemicCluster` starting ~1425 (23:45), duration ~30m.

**Test 3: Logic - Linear Merge**
*   **Input:** Windows [10:00-10:30] and [10:15-10:45].
*   **Expectation:** Single cluster [10:00-10:45].

**Test 4: Logic - Gap Tolerance**
*   **Input:** Windows [10:00-10:30] and [10:45-11:15] (15m gap).
*   **Expectation:** Single cluster [10:00-11:15].

## In-depth engineering plan

### Step 1: Install Dependencies
1.  `npm install luxon -w backend`
2.  `npm install @types/luxon --save-dev -w backend`

### Step 2: Define Types & Schemas
1.  **Schemas:** Add `GlycemicClusterSchema` to `packages/schemas/src/index.ts` (use `.strict()`).
2.  **Types:** Export `GlycemicCluster` type in `packages/types/src/index.ts`.
3.  Build: `npm run build -w @goodnumbers/schemas && npm run build -w @goodnumbers/types`.

### Step 3: Implement `HotspotDetector` (Strict TDD)

#### Cycle 1: Input Sanitization & Timezone
1.  **Red:** Create `backend/tests/unit/HotspotDetector.test.ts`. Add a test passing 6000 entries, invalid SGVs, and an invalid timezone. Assert that the internal entries list is capped at 5000, filtered, and timezone is UTC.
2.  **Green:** Create `HotspotDetector.ts`. Implement the `constructor` to slice, filter using strict limits (20-1000), and validate `DateTime.fromISO().setZone(tz).isValid`.
3.  **Refactor:** Extract constants for limits.

#### Cycle 2: Circadian Mapping
1.  **Red:** Add a test case with a specific UTC time (e.g., 2023-01-01T14:00:00Z) and a timezone (America/New_York). Assert that `normalizeToCircadian` places it in the correct minute bucket (600 for 10:00 AM).
2.  **Green:** Implement `normalizeToCircadian` using `DateTime` and modulo math.
3.  **Refactor:** Ensure the map initialization is clean.

#### Cycle 3: Scanning
1.  **Red:** Add a test case with a known pattern (e.g., 3 days of highs at 10:00 AM). Assert that `scanWindows` returns a `RawWindow` covering that time.
2.  **Green:** Implement `scanWindows` with the 0-1439 loop, 30% density check, and 3-day consistency check.
3.  **Refactor:** Optimize the lookups if needed.

#### Cycle 4: Merging (Linear & Circular)
1.  **Red:** Add test cases for Linear Merge (Overlap, Gap) and Circular Heal (Midnight Wraparound). Assert correct `GlycemicCluster` output.
2.  **Green:** Implement `mergeWindows`. First sort, then reduce for linear merge. Finally, check `last` vs `first` for circular heal.
3.  **Refactor:** Ensure strict typing of the output.

### Step 4: Integrate into Worker
1.  In `backend/src/worker.ts`:
    *   Instantiate `HotspotDetector`.
    *   Detect highs/lows.
    *   **Transaction:**
        ```typescript
        await prisma.$transaction([
          prisma.glycemicEventCluster.deleteMany({ where: { journalId } }),
          prisma.glycemicEventCluster.createMany({
             data: allClusters.map(c => ({
               // ...
               clusterDataJson: c as unknown as Prisma.InputJsonValue
             }))
          })
        ]);
        ```
2.  Verify `GlycemicClusterSchema.parse(c)` is called before saving (optional extra safety, or rely on type system if strict).

### Step 5: Verify
1.  Run `npm test -w backend`.
2.  Manual check: Ensure no PII in logs.