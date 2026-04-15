# Phase 6, TASK1.4.realcarbs.md

## **TL;DR**

Enable the end-to-end flow of real carb/insulin treatment data by persisting it in the Journal model, fetching it from Nightscout (with safety buffers), and serving it via the API to the frontend.

## **Invariants (do not change)**

1. **Strict TDD**: Write the test first. Red-Green-Refactor.
2. **Zero Mocks in Prod**: All frontend mocks for treatments must be removed by the end of this task.
3. **Data Privacy (PII)**: Treatment notes fields must **NEVER** be persisted to the database. Only whitelist numeric/date fields.
4. **Schema Stability**: Use the Json type for the treatments field, but validate strict shape at API boundary.
5. **Boundary Safety**: Fetch window must include a buffer (e.g., \+/- 3 hours) to capture meals causing events at the start/end of the reporting period.

## **Assumptions & Scope**

- **Assumption**: The Nightscout instance has treatments available (users use Nightscout to log carbs/insulin or sync from pumps).
- **Assumption**: The nightscout-js client or our custom fetcher supports, or can be easily extended to support, the /api/v1/treatments endpoint.
- **Scope**:
  - Database schema update (Journal model).
  - Backend worker logic (fetching & saving treatments).
  - Backend API response update.
  - Frontend integration (swapping mock for real data).

## **Objectives**

1. **Persistence**: Successfully store Treatment\[\] data in the Journal database record.
2. **Data Ingestion**: Fetch, clean, and normalize treatment data from Nightscout.
3. **API Delivery**: Expose the stored treatments in the GET /api/journals/:id response.
4. **Frontend Integration**: Render the real treatment data in the EventClusterCard charts, replacing all mocks.

## **Risks & Mitigations**

- **Risk**: **Boundary Effects**. A high glucose event at 00:05 on Day 1 is likely caused by a meal at 23:30 on Day 0\.
  - _Mitigation_: The worker must fetch treatments with a **3-hour buffer** before and after the 7-day glucose window.
- **Risk**: **PII Leakage**. Users type names/locations into Nightscout treatment notes.
  - _Mitigation_: **Strict Whitelist**. Only save id, timestamp, carbs, insulin, eventType, duration. Explicitly drop notes, enteredBy, etc.
- **Risk**: **Data Loss (Insulin)**. Filtering only for carbs \> 0 loses pure insulin data (correction boluses).
  - _Mitigation_: Accepted trade-off for this task. We are focusing on **Meal Visualization**. We will document this data loss.
- **Risk**: **Bad Data Types**. "45g" string instead of number.
  - _Mitigation_: Runtime parseFloat guard during normalization.

## **Method Outline**

1. **Schema Update**: Add treatments Json? to the Journal model in Prisma.
2. **Fetcher Implementation**: Extend the Nightscout client/fetcher to query /api/v1/treatments.
3. **Worker Integration**: In the journal processor, call the treatment fetcher with buffers. Sanitize and normalize.
4. **API Update**: Update the journal router to include treatments in the returned object.
5. **Frontend Cleanup**: Delete mockTreatments and bind journal.treatments to the UI.

## **Implementation Notes**

- **Prisma**:  
  Code snippet  
  model Journal {  
   // ... existing fields  
   treatments Json? // Stores Array\<Treatment\>  
  }

- **Nightscout API**:
  - Endpoint: /api/v1/treatments
  - Query: find\[created_at\]\[$gte\]=...\&find\[created\_at\]\[$lte\]=...
- **Worker Normalization Logic**:
  - **Filter**: t.carbs \> 0 (and \!isNaN(parseFloat(t.carbs))).
  - **Sanitize**: Create new object { id: t.\_id, date: t.created_at, carbs: Number(t.carbs), eventType: ... }. **Do not spread ...t**.
  - **Buffer**: If journal covers Jan 1 00:00 \- Jan 7 23:59, fetch Dec 31 21:00 \- Jan 8 03:00.
- **Validation**:
  - Update @goodnumbers/schemas (if applicable) or the Zod schema in backend to validate the treatments array structure.

## **Acceptance Gates**

- \[ \] npx prisma migrate dev runs successfully.
- \[ \] Backend integration test confirms treatments are saved to the DB after a job run.
- \[ \] The stored treatment JSON **does not** contain any notes fields (PII check).
- \[ \] GET /api/journals/:id returns a JSON object containing a non-empty treatments array.
- \[ \] Frontend shows bars on the chart without any hardcoded mocks in JournalPage.tsx.

## **“Make-sure-you” Checklist**

- \[ \] Did you run npx prisma generate after updating the schema?
- \[ \] Did you rebuild the shared packages (npm run build \-w @goodnumbers/types)?
- \[ \] Did you implement the \+/- 3 hour fetch buffer?
- \[ \] Did you explicit cast carbs to Number()?
- \[ \] Did you remove the // TODO: Remove this mock block from JournalPage.tsx?

## **Project Hygiene Prep**

1. **Branch Setup**:  
   Bash  
   git checkout develop  
   git pull origin develop  
   git checkout \-b feat/phase6-task1.5-real-data

2. **Issue Tracking**: Create issue "Implement Real Treatment Data Plumbing".

## **In-depth Test Plan**

### **1\. Integration Test (Worker)**

- **File**: backend/tests/integration/worker/journalProcessor.test.ts
- **Scenario**: Mock Nightscout response with:
  1. Valid carb entry inside window.
  2. Valid carb entry in buffer zone (e.g., 1 hour before start).
  3. Entry with PII in notes.
  4. Entry with "45g" string carbs.
- **Assertion**:
  - Job runs successfully.
  - DB contains entry 1 and 2 (buffer logic working).
  - DB entry 3 does **not** have notes field (PII safety).
  - DB entry 4 has numeric 45 (normalization safety).

### **2\. Integration Test (API)**

- **File**: backend/tests/integration/api/journal.test.ts
- **Scenario**: Create Journal with seeded treatments.
- **Assertion**:
  - GET request returns treatments array matching Zod schema.

### **3\. Manual Verification**

- **Action**: Generate journal for a real user.
- **Check**: Verify chart renders bars.
- **Check**: Verify bars match the glucose event times.

## **In-depth Engineering Plan**

### **Step 1: Database Schema & Types**

1. Modify backend/prisma/schema.prisma: Add treatments Json? to Journal.
2. Run npx prisma migrate dev \--name add-treatments-to-journal.
3. Run npx prisma generate.
4. Run npm run build \-w @goodnumbers/types.

### **Step 2: Nightscout Client Update**

5. Locate backend/src/lib/nightscout/client.ts.
6. Add fetchTreatments(start: Date, end: Date) method using /api/v1/treatments.

### **Step 3: Worker Logic**

7. Open backend/src/worker/processors/journal.ts.
8. Calculate buffered dates (start \- 3h, end \+ 3h).
9. Call fetchTreatments.
10. Implement normalizeTreatments(raw: any\[\]) inside the file or a utility:
    - Filter carbs \> 0\.
    - Map to safe object structure (whitelisting fields).
    - Parse numbers.
11. Pass sanitized result to prisma.journal.update.

### **Step 4: Frontend Integration**

12. Open frontend/src/pages/JournalPage.tsx.
13. **Delete** mockTreatments.
14. Bind response.data.treatments.
15. Verify.
