# Tasks Roadmap: GoodNumbers "Quick Coach" (Minimum Viable Beta)

We follow a strict TDD (Red/Green/Refactor) workflow. Each task requires passing tests (unit or integration) and explicit verification gates (automated and visual/manual) before proceeding.

---

## Phase 1: Database Schema & Shared Types

- [x] **Task 1: Update Schema & Type Definitions**
  - [x] **1.1:** Add `isPrimaryFocus Boolean @default(false)` to `GlycemicEventCluster` in `backend/prisma/schema.prisma`.
  - [x] **1.2:** Export `AnimationCue` and `QuickCoachStory` types in `packages/types/src/index.ts`.
  - [x] **1.3:** Run prisma migration and client generation (`npx prisma migrate dev` / `npm run build:packages`).
  - **Automated Verification Gate:** `npx vitest packages/types/src/types-package.test.ts` passes. (PASSED)
  - **Manual Verification Gate:** Inspect generated client types to ensure `isPrimaryFocus` exists on `GlycemicEventCluster`. (PASSED)

---

## Phase 2: Backend Triage Engine & Notification Webhook

- [x] **Task 2: Implement Triage Engine and Webhook Service**
  - [x] **2.1 (TDD Red):** Create unit tests in `backend/tests/unit/analysis/ClusterTriage.test.ts` asserting ranking logic (Severe Hypo > Hypo > High Variability > Hyper > Low variance).
  - [x] **2.2 (TDD Green):** Implement `triageClusters()` in `backend/src/lib/analysis/ClusterTriage.ts`.
  - [x] **2.3 (TDD Red):** Create unit tests in `backend/tests/unit/notifications/webhook.test.ts` testing webhook payload generation and delivery.
  - [x] **2.4 (TDD Green):** Implement `sendCoachNotificationWebhook()` in `backend/src/lib/notifications/webhook.ts`.
  - [x] **2.5:** Integrate triage ranking and webhook call into `backend/src/worker.ts` pipeline.
  - **Automated Verification Gate:** `npm run test:backend:ai` passes. (PASSED)
  - **Manual Verification Gate:** Run `just dev`, process a test journal, and verify `isPrimaryFocus: true` is set on exactly one cluster in SQLite DB and webhook ping log appears in console. (PASSED)

---

## Phase 3: AI Prompt Engineering & Audio-Visual Story Generator

- [x] **Task 3: Story Prompt & Generator Service**
  - [x] **3.1 (TDD Red):** Create tests in `backend/tests/unit/ai/quick_coach_story.test.ts` validating prompt compilation and JSON cue schema validation.
  - [x] **3.2 (TDD Green):** Implement `QUICK_COACH_STORY_PROMPT` in `backend/src/lib/ai/prompts.ts`.
  - [x] **3.3 (TDD Green):** Implement `generateQuickCoachStory()` in `backend/src/lib/ai/gemini.ts` with Zod schema parsing.
  - [x] **3.4:** Store generated story payload in `GlycemicEventCluster.aiInsight` or `clusterDataJson` during worker execution.
  - **Automated Verification Gate:** `npx vitest backend/tests/unit/ai/quick_coach_story.test.ts` passes. (PASSED)
  - **Manual Verification Gate:** Inspect generated story JSON to confirm valid millisecond timestamps and corresponding drawing actions (`DRAW_MEAN`, `DRAW_DAY`, `DRAW_TREATMENTS`). (PASSED)

---

## Phase 4: Frontend Standalone Route & Shell Layout

- [x] **Task 4: Setup Route & QuickCoachPage Container**
  - [x] **4.1 (TDD Red):** Create tests in `frontend/src/pages/__tests__/QuickCoachPage.test.tsx` verifying data loading, primary cluster identification, error states, and responsive layout.
  - [x] **4.2 (TDD Green):** Create `frontend/src/pages/QuickCoachPage.tsx` with clean mobile layout (Mesa palette, header badge, content container).
  - [x] **4.3:** Register `/coach/:journalId` route in `frontend/src/App.tsx`.
  - **Automated Verification Gate:** `npm run test:frontend:ai` passes. (PASSED)
  - **Manual / Visual Verification Gate:** Navigate to `http://localhost:3000/coach/[valid-journal-id]` in mobile viewport and verify distraction-free layout. (PASSED)

---

## Phase 5: ECharts & Audio Sync Component

- [x] **Task 5: Implement QuickCoachStoryPlayer**
  - [x] **5.1 (TDD Red):** Create unit tests in `frontend/src/components/coach/__tests__/QuickCoachStoryPlayer.test.tsx` testing timecode trigger events and chart series updates.
  - [x] **5.2 (TDD Green):** Implement `frontend/src/components/coach/QuickCoachStoryPlayer.tsx`:
    - ECharts canvas configured with smooth spline animations.
    - Audio player with playback controls (Play/Pause/Replay/Progress scrubber).
    - `onTimeUpdate` sync state machine dispatching `DRAW_MEAN`, `DRAW_DAY`, and `DRAW_TREATMENTS` series onto ECharts.
    - Text transcript drawer fallback for muted/inaccessible environments.
  - **Automated Verification Gate:** `npx vitest frontend/src/components/coach/__tests__/QuickCoachStoryPlayer.test.tsx` passes. (PASSED)
  - **Manual / Visual Verification Gate:** Click Play on the story player; verify the mean line draws first, followed by daily traces sequentially stacking and treatment markers appearing in sync with the narration. (PASSED)

---

## Phase 6: Voice Negotiation & Micro-Habit Interaction

- [x] **Task 6: Implement QuickCoachVoiceNegotiation**
  - [x] **6.1 (TDD Red):** Create unit tests in `frontend/src/components/coach/__tests__/QuickCoachVoiceNegotiation.test.tsx` testing speech recognition transitions, chat endpoint integration, and goal extraction.
  - [x] **6.2 (TDD Green):** Implement `frontend/src/components/coach/QuickCoachVoiceNegotiation.tsx`:
    - Push-to-Talk / Web Speech API integration with microphone visualizer pulse.
    - Text chat input fallback.
    - Chat message stream hitting `POST /api/journals/:id/clusters/:clusterId/chat`.
    - Synthesized Goal Proposal Card highlighting the single weekly micro-habit.
  - **Automated Verification Gate:** `npx vitest frontend/src/components/coach/__tests__/QuickCoachVoiceNegotiation.test.tsx` passes. (PASSED)
  - **Manual / Visual Verification Gate:** Test speaking or typing a reflection; verify the AI responds empathetically and produces a crisp single micro-habit proposal card. (PASSED)

---

## Phase 7: Handshake, Goal Persistence & Celebration State

- [x] **Task 7: Goal Handshake & End-to-End Persistence**
  - [x] **7.1 (TDD Red):** Create integration tests in `frontend/src/pages/__tests__/QuickCoachFlow.integration.test.tsx` testing full flow from story play to saving `goalsForNextWeek` and rendering celebration.
  - [x] **7.2 (TDD Green):** Implement `StickyActionBar` integration in `QuickCoachPage.tsx` with "Accept & Save Goal" button calling `PUT /api/journals/:id`.
  - [x] **7.3 (TDD Green):** Implement celebration modal/view with `WeeklyVibe` emojis, motivational copy, and quick exit to dashboard.
  - **Automated Verification Gate:** `npm run test:ai` (all frontend and backend tests pass 100%). (PASSED)
  - **Manual / Visual Verification Gate:** Complete the Quick Coach flow on `/coach/:journalId`, save the goal, then open `http://localhost:3000/journal/:journalId` and verify the goal appears in the standard `Goals.tsx` section. (PASSED)
