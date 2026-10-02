# Tasks Roadmap: Quick Coach Automation & Manual Triggering

We follow a strict TDD (Red/Green/Refactor) workflow. Each task requires passing unit/integration tests and explicit automated & manual verification gates before completion.

---

## Overview & Architecture

This task set implements weekly automatic execution and manual instant triggers for the GoodNumbers Quick Coach pipeline:

1. **CLI Trigger Script (`npm run trigger:coaching`)**: Accepts a `--username` or `--email` flag, resolves the user in SQLite, creates a 7-day journal, enqueues it into BullMQ, and monitors progress through completion and Discord webhook notification.
2. **Backend API Endpoint (`POST /api/journals/trigger-now`)**: Enables authenticated users to trigger an on-demand Quick Coach run for their account.
3. **Frontend Dashboard Button ("Send Coaching Now")**: UI button with loading/toast state to execute on-demand coaching sessions.
4. **BullMQ Repeatable Scheduler**: Configurable weekly cron schedule in `backend/src/worker.ts` that automatically triggers journals for all active Nightscout users every Friday at 4:00 PM.

---

## Phase 1: CLI Script for User-Specific Trigger (`scripts/trigger-coaching.ts`)

- [x] **Task 1: User Lookup & Journal Enqueueing Logic**
  - [x] **1.1 (TDD Red):** Create unit tests in `backend/tests/unit/scripts/trigger_coaching.test.ts`:
    - Test argument parsing (`--username=<name>` or `--email=<email>`).
    - Test user lookup logic via Prisma: returns user if found, throws descriptive error if user is missing or missing Nightscout credentials.
    - Test 7-day date window calculation.
    - Test job enqueueing to BullMQ `journal-processing` queue.
  - [x] **1.2 (TDD Green):** Implement CLI script helper functions in `backend/src/lib/cli/triggerCoaching.ts`.
  - [x] **1.3 (TDD Green):** Create executable entrypoint in `backend/scripts/trigger-coaching.ts`:
    - Parse CLI flags using standard Node args parsing (e.g., `--username=clark` or `--email=clark@example.com`).
    - Connect to Prisma and query `user` table matching `username` or `email`.
    - Create a new `Journal` record for the user (7-day lookback window, status `PENDING`).
    - Enqueue `process-journal` job to Redis/BullMQ.
    - Poll journal status until `COMPLETE` or `FAILED` and log live progress.
  - [x] **1.4:** Add `"trigger:coaching": "tsx scripts/trigger-coaching.ts"` script to `backend/package.json`.
  - **Automated Verification Gate:** `npx vitest backend/tests/unit/scripts/trigger_coaching.test.ts` passes. (PASSED)
  - **Manual Verification Gate:** Run `npm run trigger:coaching -- --username=<your-username>` in terminal; verify job processes, Discord notification ping arrives, and terminal prints the magic link `http://localhost:3000/coach/<journal-id>`. (PASSED)

---

## Phase 2: On-Demand API Endpoint (`POST /api/journals/trigger-now`)

- [ ] **Task 2: API Route Integration**
  - [ ] **2.1 (TDD Red):** Create integration test in `backend/tests/integration/journalTriggerRoute.test.ts`:
    - Assert `POST /api/journals/trigger-now` requires authentication (401 if unauthenticated).
    - Assert missing Nightscout credentials return 400 Bad Request with actionable message.
    - Assert successful request creates `PENDING` journal and enqueues BullMQ job.
    - Assert double-click / rate limit protection (prevents triggering duplicate jobs if a journal is currently processing).
  - [ ] **2.2 (TDD Green):** Add `POST /trigger-now` endpoint to `backend/src/routes/journal.ts`.
  - **Automated Verification Gate:** `npx vitest backend/tests/integration/journalTriggerRoute.test.ts` passes.
  - **Manual Verification Gate:** Use Postman/cURL with session cookie to `POST /api/journals/trigger-now`; verify 201 response and job appearing in BullMQ queue.

---

## Phase 3: Frontend Dashboard Trigger Button

- [ ] **Task 3: Dashboard UI "Send Coaching Now" Component**
  - [ ] **3.1 (TDD Red):** Create component tests in `frontend/src/components/journal/__tests__/SendCoachingButton.test.tsx`:
    - Test initial idle state ("⚡ Send Coaching Now").
    - Test click handler dispatching API request to `/api/journals/trigger-now`.
    - Test loading state (spinner / progress message) and success notification with link to `/coach/:journalId`.
  - [ ] **3.2 (TDD Green):** Create `frontend/src/components/journal/SendCoachingButton.tsx`.
  - [ ] **3.3:** Integrate `SendCoachingButton` into `frontend/src/pages/Dashboard.tsx` or Header bar.
  - **Automated Verification Gate:** `npx vitest frontend/src/components/journal/__tests__/SendCoachingButton.test.tsx` passes.
  - **Manual Verification Gate:** Click "Send Coaching Now" on dashboard UI; observe loading indicator turn into a ready notification with direct link to standalone coach player.

---

## Phase 4: BullMQ Repeatable Weekly Scheduler

- [ ] **Task 4: Automatic Weekly Scheduler in Worker**
  - [ ] **4.1 (TDD Red):** Create unit tests in `backend/tests/unit/worker/scheduler.test.ts`:
    - Test repeatable job registration with custom cron pattern (`WEEKLY_COACH_CRON`).
    - Test multi-user scheduler job handler: queries all users with valid `nightscoutUrl` and `nightscoutToken`, creating and queueing journals for each.
  - [ ] **4.2 (TDD Green):** Implement `setupWeeklyScheduler()` in `backend/src/worker.ts`:
    - Define schedule handler `processWeeklySchedulerJob()`.
    - Read `WEEKLY_COACH_CRON` from `process.env` (default `0 16 * * 5` for Friday 4:00 PM).
    - Queue repeatable job on worker startup when enabled.
  - **Automated Verification Gate:** `npx vitest backend/tests/unit/worker/scheduler.test.ts` passes.
  - **Manual Verification Gate:** Set `WEEKLY_COACH_CRON="* * * * *"` (every minute) in local `.env`, restart worker, and observe automatic journal creation and Discord webhook delivery.

---

## Execution Checklist & Definition of Done

1. All new code MUST follow TDD (Red test written and failing before Green implementation).
2. All unit and integration tests pass cleanly (`npm run test:backend` and `npm run test:frontend`).
3. Running `npm run trigger:coaching -- --username=<user>` successfully generates a Quick Coach report and sends a Discord webhook ping with the `/coach/:journalId` magic link.
