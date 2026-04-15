# {{PROJECT_NAME}} — `todo.md`

## TL;DR

Enable end-to-end flow of real Nightscout treatment data (carbs/insulin) by refactoring the Nightscout client for precise date ranges, persisting sanitized data in the Journal, and removing frontend mocks, strictly following TDD.

## Invariants (do not change)

1.  **Strict TDD**: Write the test first. **Red** (fail) -> **Green** (pass) -> **Refactor**.
2.  **Zero Mocks in Prod**: All hardcoded frontend treatment mocks must be removed.
3.  **Privacy First (PII)**: **NEVER** persist `notes`, `enteredBy`, or raw `...spread` objects. Whitelist only: `id`, `date`, `carbs`, `insulin`, `eventType`.
4.  **Boundary Safety**: Fetch window must be **Journal Window +/- 3 hours** (180 mins) to capture meals causing delayed spikes.
5.  **Type Safety**: Explicitly cast `carbs` and `insulin` to `number` as Nightscout API often returns strings.

## Assumptions & Scope

- **Assumption**: The Journal always covers the "last 7 days" relative to creation time.
- **Scope**: Backend (Prisma, Worker, Nightscout Client), Shared Types, Frontend (Journal Page).

## Objectives

1.  **Precision Fetching**: Refactor `NightscoutClient` to support exact `startDate` and `endDate` querying.
2.  **Buffered Data**: Capture treatments 3 hours before the journal start time.
3.  **Sanitized Persistence**: Store clean, PII-free treatment JSON in the `Journal` table.
4.  **Visual Verification**: Render real blue carb bars on the frontend charts.

## Risks & Mitigations

- **Risk**: **Stringy Data**. Nightscout often returns `"carbs": "45"` or `"carbs": null`.
  - _Mitigation_: Use `Number()` casting and strict `!isNaN` checks during normalization.
- **Risk**: **Timezone Confusion**. `fetchTreatments` currently uses `Date.now()`.
  - _Mitigation_: Switch to explicit `Date` objects passed from the worker to ensure the buffer is applied correctly in UTC.
- **Risk**: **Huge Payloads**. Users with pumps might have hundreds of micro-boluses.
  - _Mitigation_: Filter out entries where `carbs === 0` AND `insulin === 0` to keep the JSON payload light.

## Method Outline

1.  **Schema**: Add `treatments Json?` to `Journal` model.
2.  **Client Refactor (TDD)**: Test that `fetchTreatments` accepts date ranges -> Implement it.
3.  **Worker Logic (TDD)**: Test that worker sanitizes and persists data -> Implement buffer/fetch/save logic.
4.  **Frontend**: Bind real data to `EventClusterCard`.

## Implementation Notes

- **Prisma**: Use `Json?` type.
- **Sanitization Function**:

  ```typescript
  import { z } from "zod";

  // 1. Define the Strict Schema (The Firewall)
  const StoredTreatmentSchema = z.object({
    id: z.string(),
    date: z.number(),
    carbs: z.number().nullable(),
    insulin: z.number().nullable(),
    eventType: z
      .string()
      .max(50)
      .transform((val) => val || "Unknown"), // Cap length, handle nulls
  });

  function normalizeTreatment(t: NightscoutTreatment) {
    // 2. Robust Number Parsing
    const parseValue = (val: any): number | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    const carbs = parseValue(t.carbs);
    const insulin = parseValue(t.insulin);

    // 3. Data Minimization: Drop empty records
    if (!carbs && !insulin) return null;

    const rawObj = {
      id: t._id,
      date: t.date || new Date(t.created_at).getTime(),
      carbs: carbs || 0, // Store 0 for chart convenience, or keep null if preferred
      insulin: insulin || 0,
      eventType: t.eventType,
    };

    // 4. Validate against Zod to strip unknown fields and ensure type safety
    return StoredTreatmentSchema.parse(rawObj);
  }
  ```

- **Nightscout Query**:
  - `find[created_at][$gte] = start.toISOString()`
  - `find[created_at][$lte] = end.toISOString()`

## Acceptance Gates

- [ ] `npx prisma migrate dev` runs successfully.
- [ ] `NightscoutClient` tests pass with explicit date ranges.
- [ ] Worker integration tests pass, verifying PII stripping and numeric casting.
- [ ] `GET /api/journals/:id` returns the treatments array.
- [ ] Frontend `JournalPage.tsx` has NO mock data.

## "Make-sure-you" Checklist

- [ ] Run `npx prisma generate` after schema changes.
- [ ] Run `npm run build -w @goodnumbers/types` to propagate type changes.
- [ ] Check that `carbs` are actually numbers in the DB (not strings).
- [ ] Verify the 3-hour buffer: If journal starts at 00:00, a meal at 21:30 previous day MUST be included.

## Project hygiene prep

1.  **Branch**: `git checkout -b feat/phase6-task1.4-real-treatments`
2.  **Issue**: "Implement Real Treatment Data Plumbing"

## In-depth Engineering Plan (TDD Process)

### Phase 1: Foundation (Schema)

- **Action**: Update `backend/prisma/schema.prisma` to add `treatments Json?` to `Journal`.
- **Action**: Run `npx prisma migrate dev --name add_treatments_to_journal`.
- **Action**: Run `npx prisma generate` and `npm run build -w @goodnumbers/types`.

### Phase 2: Nightscout Client Refactor (TDD)

1.  **RED (Write Test)**
    - Create/Update `backend/src/lib/nightscout/client.test.ts`.
    - Add a test case: `should fetch treatments within exact date range`.
    - Mock `axios.get`.
    - Call `client.fetchTreatments(startDate, endDate)`.
    - **Expectation**: `axios.get` is called with params `find[created_at][$gte]` matching `startDate` and `find[created_at][$lte]` matching `endDate`.
    - _Run test -> FAIL (Method signature doesn't match/exist)._

2.  **GREEN (Implement)**
    - Modify `backend/src/lib/nightscout/client.ts`.
    - Update `fetchTreatments` signature to accept `(from: Date, to: Date)`.
    - Update the logic to use these dates for the API query parameters.
    - _Run test -> PASS._

3.  **REFACTOR**
    - Remove any legacy code related to `days` argument in `fetchTreatments`.
    - Ensure type safety on the return value.

### Phase 3: Worker Logic (TDD)

1.  **RED (Write Test)**
    - Create/Update `backend/tests/integration/worker/journalProcessor.test.ts`.
    - **Scenario**: "Worker should buffer, sanitize, and persist treatments".
    - **Setup**:
      - Mock `NightscoutClient.fetchTreatments` to return:
        - `T1`: Inside window, valid numbers.
        - `T2`: Inside 3hr buffer, valid.
        - `T3`: Outside buffer (should be ignored if client didn't filter, but client does, so just ensure it's handled).
        - `T4`: Has `notes` (PII).
        - `T5`: `carbs` is a string "30".
        - `T6`: Empty record (carbs=null, insulin=null).
    - **Action**: Run `processJournalJob`.
    - **Expectation**:
      - `prisma.journal.update` is called with `treatments` array.
      - Array contains `T1` and `T2`.
      - `T4` is present but `notes` is `undefined`.
      - `T5` is present and `carbs` is `30` (number).
      - `T6` is NOT present.
    - _Run test -> FAIL (Logic not implemented)._

2.  **GREEN (Implement)**
    - Open `backend/src/worker.ts`.
    - Define `BUFFER_HOURS = 3`.
    - Calculate `fetchStart` and `fetchEnd` using the buffer.
    - Call `client.fetchTreatments(fetchStart, fetchEnd)`.
    - Implement `normalizeTreatment` function (filter `carbs>0`, whitelist fields, cast numbers).
    - Update `prisma.journal.update` payload to include `treatments`.
    - _Run test -> PASS._

3.  **REFACTOR**
    - Extract `normalizeTreatment` to a utility file if it's too large.
    - Ensure logging is clean.

### Phase 4: Frontend Integration (Manual)

1.  **Action**: Open `frontend/src/pages/JournalPage.tsx`.
2.  **Action**: Delete `mockTreatments` block.
3.  **Action**: Pass `journal.treatments` to `EventClusterCard`.
4.  **Verification**: Start the app, generate a journal, and visually confirm the charts.
