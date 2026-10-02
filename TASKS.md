# Tasks Roadmap: Collaborative AI Chat Insights

We follow a strict TDD (Red/Green/Refactor) workflow. Each task requires passing tests (unit or integration) and verification gates.

## Task List

- [x] **Task 1: Update AI Insight Schema and Prompt Generator**
  - [x] **1.1:** Add `initialPrompt` to Types (`AiInsight` structure).
  - [x] **1.2:** Update `CLUSTER_AI_INSIGHT_PROMPT` in `prompts.ts` to output `initial_prompt`.
  - [x] **1.3:** Update `generateClusterAIInsight` in `gemini.ts` to extract and return `initialPrompt`.
  - **Verification Gate:** `npx vitest backend/tests/integration/worker/ai_insights.test.ts` passes. (PASSED)

- [x] **Task 2: Implement Chat and Synthesis Services**
  - [x] **2.1:** Implement `generateChatResponse` in `backend/src/lib/ai/gemini.ts`.
  - [x] **2.2:** Implement `synthesizeChatInsight` in `backend/src/lib/ai/gemini.ts`.
  - **Verification Gate:** New unit tests in `backend/tests/unit/ai/gemini_chat.test.ts` pass. (PASSED)

- [x] **Task 3: Expose API Routes**
  - [x] **3.1:** Create `POST /api/journals/:id/clusters/:clusterId/chat` endpoint.
  - [x] **3.2:** Create `POST /api/journals/:id/clusters/:clusterId/save-insight` endpoint.
  - **Verification Gate:** Integration tests in `backend/tests/integration/journalChatRoutes.test.ts` pass. (PASSED)

- [x] **Task 4: Build Frontend Chat Component**
  - [x] **4.1:** Create `ClusterChatInterface.tsx` with transient client-side state.
  - **Verification Gate:** Unit tests in `frontend/src/components/journal/__tests__/ClusterChatInterface.test.tsx` pass. (PASSED)

- [x] **Task 5: Integrate Hybrid Flow in EventClusterCard**
  - [x] **5.1:** Render "💡 Help me reflect" button in `EventClusterCard.tsx`.
  - [x] **5.2:** Handle view state toggling and pass synthesized notes back to parent form.
  - **Verification Gate:** Frontend tests in `frontend/src/components/journal/EventClusterCard.test.tsx` pass. (PASSED)

---

# Roadmap: GoodNumbers "Quick Coach" (Minimum Viable Beta)

- [x] **Task 1: Update Schema & Type Definitions**
  - [x] **1.1:** Add `isPrimaryFocus Boolean @default(false)` to `GlycemicEventCluster` in `backend/prisma/schema.prisma`.
  - [x] **1.2:** Export `AnimationCue` and `QuickCoachStory` types in `packages/types/src/index.ts`.
  - [x] **1.3:** Run prisma migration and client generation (`npx prisma migrate dev` / `npm run build:packages`).
  - **Verification Gate:** `npx vitest packages/types/src/types-package.test.ts` passes. (PASSED)

- [x] **Task 2: Implement Triage Engine and Notification Webhook**
  - [x] **2.1 (TDD Red):** Create unit tests in `backend/tests/unit/analysis/ClusterTriage.test.ts`.
  - [x] **2.2 (TDD Green):** Implement `triageClusters()` in `backend/src/lib/analysis/ClusterTriage.ts`.
  - [x] **2.3 (TDD Red):** Create unit tests in `backend/tests/unit/notifications/webhook.test.ts`.
  - [x] **2.4 (TDD Green):** Implement `sendCoachNotificationWebhook()` in `backend/src/lib/notifications/webhook.ts`.
  - [x] **2.5:** Integrate triage ranking and webhook call into `backend/src/worker.ts`.
  - **Verification Gate:** `npm run test:backend:ai` passes. (PASSED)

- [x] **Task 3: Story Prompt & Generator Service**
  - [x] **3.1 (TDD Red):** Create tests in `backend/tests/unit/ai/quick_coach_story.test.ts`.
  - [x] **3.2 (TDD Green):** Implement `QUICK_COACH_STORY_PROMPT` in `backend/src/lib/ai/prompts.ts`.
  - [x] **3.3 (TDD Green):** Implement `generateQuickCoachStory()` in `backend/src/lib/ai/gemini.ts`.
  - [x] **3.4:** Store generated story in cluster records in `backend/src/worker.ts`.
  - **Verification Gate:** `npx vitest backend/tests/unit/ai/quick_coach_story.test.ts` passes. (PASSED)

- [x] **Task 4: Setup Route & QuickCoachPage Container**
  - [x] **4.1 (TDD Red):** Create tests in `frontend/src/pages/__tests__/QuickCoachPage.test.tsx`.
  - [x] **4.2 (TDD Green):** Create `frontend/src/pages/QuickCoachPage.tsx`.
  - [x] **4.3:** Register `/coach/:journalId` in `frontend/src/App.tsx`.
  - **Verification Gate:** `npm run test:frontend:ai` passes. (PASSED)

- [x] **Task 5: Implement QuickCoachStoryPlayer (ECharts & Audio Sync)**
  - [x] **5.1 (TDD Red):** Create tests in `frontend/src/components/coach/__tests__/QuickCoachStoryPlayer.test.tsx`.
  - [x] **5.2 (TDD Green):** Implement `frontend/src/components/coach/QuickCoachStoryPlayer.tsx` with ECharts series stacking and `onTimeUpdate` sync.
  - **Verification Gate:** `npx vitest frontend/src/components/coach/__tests__/QuickCoachStoryPlayer.test.tsx` passes. (PASSED)

- [x] **Task 6: Implement QuickCoachVoiceNegotiation**
  - [x] **6.1 (TDD Red):** Create tests in `frontend/src/components/coach/__tests__/QuickCoachVoiceNegotiation.test.tsx`.
  - [x] **6.2 (TDD Green):** Implement `frontend/src/components/coach/QuickCoachVoiceNegotiation.tsx` with Push-to-Talk / Web Speech API.
  - **Verification Gate:** `npx vitest frontend/src/components/coach/__tests__/QuickCoachVoiceNegotiation.test.tsx` passes. (PASSED)

- [x] **Task 7: Goal Handshake & End-to-End Persistence**
  - [x] **7.1 (TDD Red):** Create integration tests in `frontend/src/pages/__tests__/QuickCoachFlow.integration.test.tsx` testing full flow from story play to saving `goalsForNextWeek` and rendering celebration.
  - [x] **7.2 (TDD Green):** Implement `StickyActionBar` integration in `QuickCoachPage.tsx` with "Accept & Save Goal" button calling `PUT /api/journals/:id`.
  - [x] **7.3 (TDD Green):** Implement celebration modal/view with `WeeklyVibe` emojis, motivational copy, and quick exit to dashboard.
  - **Verification Gate:** `frontend/src/pages/__tests__/QuickCoachFlow.integration.test.tsx` and all unit/integration tests pass. (PASSED)

---

# Roadmap: Quick Coach Weekly Automation & Manual Triggering

_(Full detailed breakdown in [`docs/quick_coach/automation_tasks.md`](file:///home/clark/dev/goodnumbers-clean/docs/quick_coach/automation_tasks.md))_

- [x] **Task 1: CLI Script & Crontab Engine for User-Specific Trigger (`scripts/trigger-coaching.ts`)**
  - [x] **1.1 (TDD Red):** Unit tests in `backend/tests/unit/scripts/trigger_coaching.test.ts` for argument parsing (`--username`, `--email`, `--all`) and Prisma user lookup.
  - [x] **1.2 (TDD Green):** Implement `backend/src/lib/cli/triggerCoaching.ts` and CLI entrypoint `backend/scripts/trigger-coaching.ts`.
  - [x] **1.3:** Register `"trigger:coaching"` script in `backend/package.json` and install Friday 9:00 AM system `crontab` entry with PM2 background worker (`ecosystem.config.cjs`).
  - [x] **1.4 (Quick Coach UX Polish):** Multi-turn chat feed, transcript goal synthesis (`🎯 Draft Micro-Goal from Conversation`), and unit-free TTS speech synthesis.
  - **Verification Gate:** `npm run trigger:coaching -- --email=goodnumbersmain@gmail.com` triggers processing and sends Discord magic link notification. (PASSED)

- [ ] **Task 2: On-Demand API Endpoint (`POST /api/journals/trigger-now`)**
  - [ ] **2.1 (TDD Red):** Integration test in `backend/tests/integration/journalTriggerRoute.test.ts`.
  - [ ] **2.2 (TDD Green):** Implement `POST /trigger-now` route in `backend/src/routes/journal.ts`.
  - **Verification Gate:** Authenticated `POST /api/journals/trigger-now` creates journal and enqueues BullMQ job.

- [ ] **Task 3: Dashboard UI "Send Coaching Now" Component**
  - [ ] **3.1 (TDD Red):** Component tests in `frontend/src/components/journal/__tests__/SendCoachingButton.test.tsx`.
  - [ ] **3.2 (TDD Green):** Implement `SendCoachingButton.tsx` and integrate into `Dashboard.tsx`.
  - **Verification Gate:** Clicking button triggers coaching pipeline and displays live progress notification.

- [ ] **Task 4: BullMQ Repeatable Weekly Scheduler in Worker**
  - [ ] **4.1 (TDD Red):** Unit tests in `backend/tests/unit/worker/scheduler.test.ts`.
  - [ ] **4.2 (TDD Green):** Implement `setupWeeklyScheduler()` in `backend/src/worker.ts` with `WEEKLY_COACH_CRON`.
  - **Verification Gate:** Worker automatically triggers Friday 4:00 PM cron schedule for active users.
