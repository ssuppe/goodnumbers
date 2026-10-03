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

_(Full detailed breakdown in [`docs/quick_coach/automation_tasks.md`](file:///home/clark/dev/goodnumbers-clean/docs/quick_coach/automation_tasks.md) and [`docs/quick_coach/dashboard_trigger_plan.md`](file:///home/clark/dev/goodnumbers-clean/docs/quick_coach/dashboard_trigger_plan.md))_

- [x] **Task 1: CLI Script & Crontab Engine for User-Specific Trigger (`scripts/trigger-coaching.ts`)**
  - [x] **1.1 (TDD Red):** Unit tests in `backend/tests/unit/scripts/trigger_coaching.test.ts` for argument parsing (`--username`, `--email`, `--all`) and Prisma user lookup.
  - [x] **1.2 (TDD Green):** Implement `backend/src/lib/cli/triggerCoaching.ts` and CLI entrypoint `backend/scripts/trigger-coaching.ts`.
  - [x] **1.3:** Register `"trigger:coaching"` script in `backend/package.json` and install Friday 9:00 AM system `crontab` entry with PM2 background worker (`ecosystem.config.cjs`).
  - [x] **1.4 (Quick Coach UX Polish):** Multi-turn chat feed, transcript goal synthesis (`🎯 Draft Micro-Goal from Conversation`), and unit-free TTS speech synthesis.
  - **Verification Gate:** `npm run trigger:coaching -- --email=goodnumbersmain@gmail.com` triggers processing and sends Discord magic link notification. (PASSED)

- [x] **Task 2: On-Demand API Endpoint (`POST /api/coach/sessions`)**
  - [x] **2.1 (TDD Red):** Integration test in `backend/tests/integration/coachSessionsRoute.test.ts`.
  - [x] **2.2 (TDD Green):** Implement `POST /sessions` route in `backend/src/routes/coach.ts` and mount in `backend/src/index.ts`.
  - **Verification Gate:** Authenticated `POST /api/coach/sessions` creates journal and enqueues BullMQ job. (PASSED)

- [x] **Task 3: Dashboard UI "Quick Coach" Component & Routing**
  - [x] **3.1 (TDD Red/Green):** Add `?target=coach` redirection support to `JournalLoadingPage.tsx` with unit tests.
  - [x] **3.2 (TDD Red):** Component tests in `frontend/src/components/dashboard/__tests__/QuickCoachBannerCard.test.tsx`.
  - [x] **3.3 (TDD Green):** Implement `QuickCoachBannerCard.tsx` and integrate into `DashboardPage.tsx`.
  - **Verification Gate:** Clicking button triggers coaching pipeline, shows loading state, and redirects to `/coach/:id`. (PASSED)

---

# Roadmap: Quick Coach High-Reasoning AI & UX Resilience (TDD)

- [x] **Task 1: AI Model Decoupling & Flagship Reasoning for Quick Coach**
  - [x] **1.1 (TDD Red):** Add unit tests in `backend/tests/unit/ai/gemini_models.test.ts` asserting model exports (`GEMINI_REASONING_MODEL` defaulting to `gemini-3.1-pro-preview`, `GEMINI_FLASH_MODEL` defaulting to `gemini-3.8-flash`), environment overrides, and ensuring `generateQuickCoachStory`, `generateChatResponse`, and `synthesizeChatInsight` use the reasoning model. (PASSED)
  - [x] **1.2 (TDD Green):** Implement decoupled model configuration and assign the flagship reasoning model to Quick Coach stories, negotiation tool loop, and goal synthesis in `backend/src/lib/ai/gemini.ts`. (PASSED)
  - **Verification Gate:** `npx vitest backend/tests/unit/ai/gemini_models.test.ts` passes. (PASSED)

- [x] **Task 2: Interactive Chat Tool Loop Optimization & Fallback Circuit Breaker**
  - [x] **2.1 (TDD Red):** Add tests in `backend/tests/unit/ai/gemini_tool_loop_resilience.test.ts` verifying tool loop is capped at 2 iterations for interactive latency control, and falls back to flash if reasoning model fails. (PASSED)
  - [x] **2.2 (TDD Green):** Implement iteration cap and automatic flash fallback in `generateChatResponse()` in `backend/src/lib/ai/gemini.ts`. (PASSED)
  - **Verification Gate:** `npx vitest backend/tests/unit/ai/gemini_tool_loop_resilience.test.ts` passes. (PASSED)

- [x] **Task 3: Quick Coach Voice Negotiation UX - Progressive Thinking & Retry**
  - [x] **3.1 (TDD Red):** Add unit tests in `frontend/src/components/coach/__tests__/QuickCoachVoiceNegotiation.test.tsx` for progressive loading indicators ("Reviewing your pattern...", "Investigating past treatments...") and user-facing retry UI on network/timeout failure. (PASSED)
  - [x] **3.2 (TDD Green):** Implement progressive thinking states and retry button in `frontend/src/components/coach/QuickCoachVoiceNegotiation.tsx`. (PASSED)
  - **Verification Gate:** `npm --prefix frontend test src/components/coach/__tests__/QuickCoachVoiceNegotiation.test.tsx` passes. (PASSED)

- [x] **Task 4: Documentation Sync & Full Verification**
  - [x] **4.1:** Update `docs/eng/AI_MODELS.md` and `docs/PRD.md`. (PASSED)
  - [x] **4.2:** Run full backend (`npm run test:ai`) and frontend test suites. (PASSED)
  - **Verification Gate:** All test suites pass. (PASSED)

- [ ] **Task 4: BullMQ Repeatable Weekly Scheduler in Worker**
  - [ ] **4.1 (TDD Red):** Unit tests in `backend/tests/unit/worker/scheduler.test.ts`.
  - [ ] **4.2 (TDD Green):** Implement `setupWeeklyScheduler()` in `backend/src/worker.ts` with `WEEKLY_COACH_CRON`.
  - **Verification Gate:** Worker automatically triggers Friday 4:00 PM cron schedule for active users.

---

# Roadmap: Quick Coach Investigative Tool Calling (Gemini Function Calling)

_(Full technical design in [`docs/design/quick-coach-investigative-tools-prd.md`](docs/design/quick-coach-investigative-tools-prd.md))_

### Phase 1: Tool Declarations & Dispatcher Infrastructure

- [x] **Task 1: Tool Declaration Schemas**
  - [x] **1.1 (TDD Red):** Create unit tests in `backend/tests/unit/ai/tools/declarations.test.ts` verifying all 10 Gemini `FunctionDeclaration` definitions (valid SchemaType, enum parameters, required fields, and non-empty descriptions). (PASSED)
  - [x] **1.2 (TDD Green):** Implement `backend/src/lib/ai/tools/declarations.ts` exporting `COACH_INVESTIGATIVE_TOOLS`. (PASSED)
- [x] **Task 2: Dispatcher Core & Caching Engine**
  - [x] **2.1 (TDD Red):** Create unit tests in `backend/tests/unit/ai/tools/dispatcher.test.ts` testing `dispatchToolCall()`:
    - Routing to proper handler by name.
    - 8,000ms circuit breaker timeout rejection.
    - Graceful error handling for unknown tools.
    - In-memory 60-second TTL cache for identical date ranges. (PASSED)
  - [x] **2.2 (TDD Green):** Implement `backend/src/lib/ai/tools/dispatcher.ts` with `ToolExecutionContext` (userId, preferredUnits, timezone, nsClient, localJournalData) and in-memory TTL caching. (PASSED)
  - [x] **2.3:** Create `backend/src/lib/ai/tools/index.ts` exporting schemas, types, and dispatcher. (PASSED)
  - **Verification Gate (Automated):** `npx vitest backend/tests/unit/ai/tools/declarations.test.ts backend/tests/unit/ai/tools/dispatcher.test.ts` passes. (PASSED)

---

### Phase 2: Implement Tool Handlers (TDD Red/Green)

#### Group A: CGM Time Slicing & Profile Inspection

- [x] **Task 3: Tool 1 - `compare_recurring_time_window`**
  - [x] **3.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/compareTimeWindow.test.ts` (timezone filtering e.g. 06:00-10:00, unit conversion mg/dL to mmol/L, daily grouping, pattern classification, empty sensor gaps). (PASSED)
  - [x] **3.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/compareTimeWindow.ts`. (PASSED)
- [x] **Task 4: Tool 2 - `get_profile_and_override_history`**
  - [x] **4.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/profileOverrides.test.ts` (extracting active profile and parsing `Profile Switch`, `Temp Target`, `Override` treatment events). (PASSED)
  - [x] **4.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/profileOverrides.ts`. (PASSED)
- [x] **Task 5: Tool 3 - `find_successful_reference_days`**
  - [x] **5.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/referenceDays.test.ts` (identifying candidate success days by low SD/high TIR/no hypo in target window, linking matching meal treatments). (PASSED)
  - [x] **5.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/referenceDays.ts`. (PASSED)
  - **Verification Gate (Automated):** `npx vitest backend/tests/unit/ai/tools/handlers/compareTimeWindow.test.ts backend/tests/unit/ai/tools/handlers/profileOverrides.test.ts backend/tests/unit/ai/tools/handlers/referenceDays.test.ts` passes. (PASSED)

#### Group B: Treatments, Patterns & Post-Meal Peaks

- [x] **Task 6: Tool 4 - `get_treatments_for_recurring_window`**
  - [x] **6.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/recurringTreatments.test.ts` (filtering treatments by local clock hours `[startHour, endHour)`, grouping by date, filtering by type). (PASSED)
  - [x] **6.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/recurringTreatments.ts`. (PASSED)
- [x] **Task 7: Tool 5 - `check_day_of_week_pattern`**
  - [x] **7.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/dayOfWeekPattern.test.ts` (aggregating weekday vs weekend metrics: TIR, mean, CV%, specific day lookups across 1-4 weeks). (PASSED)
  - [x] **7.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/dayOfWeekPattern.ts`. (PASSED)
- [x] **Task 8: Tool 6 - `get_post_meal_peak_trends`**
  - [x] **8.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/postMealPeaks.test.ts` (calculating pre-meal baseline, peak BG, average rise, and time-to-peak minutes for breakfast, lunch, dinner). (PASSED)
  - [x] **8.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/postMealPeaks.ts`. (PASSED)
  - **Verification Gate (Automated):** `npx vitest backend/tests/unit/ai/tools/handlers/recurringTreatments.test.ts backend/tests/unit/ai/tools/handlers/dayOfWeekPattern.test.ts backend/tests/unit/ai/tools/handlers/postMealPeaks.test.ts` passes. (PASSED)

#### Group C: Treatment Notes, Pump Basals, Insulin Trends & Prior Context

- [x] **Task 9: Tool 7 - `search_treatment_notes`**
  - [x] **9.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/searchNotes.test.ts` (case-insensitive keyword matching in treatment notes, correlated BG at time). (PASSED)
  - [x] **9.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/searchNotes.ts`. (PASSED)
- [x] **Task 10: Tool 8 - `get_temp_basal_and_suspends`**
  - [x] **10.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/tempBasals.test.ts` (parsing `Temp Basal` and `Pump Suspend` treatment events, calculating suspended minutes, graceful fallback when no loop records exist). (PASSED)
  - [x] **10.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/tempBasals.ts`. (PASSED)
- [x] **Task 11: Tool 9 - `get_daily_insulin_and_carb_trends`**
  - [x] **11.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/insulinCarbTrends.test.ts` (daily insulin TDD, basal vs bolus ratio, daily carbs sum). (PASSED)
  - [x] **11.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/insulinCarbTrends.ts`. (PASSED)
- [x] **Task 12: Tool 10 - `inspect_prior_context`**
  - [x] **12.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/tools/handlers/priorContext.test.ts` (extracting 4-8 hour window before target timestamp, intervening boluses/carbs, glucose trajectory). (PASSED)
  - [x] **12.2 (TDD Green):** Implement `backend/src/lib/ai/tools/handlers/priorContext.ts`. (PASSED)
  - **Verification Gate (Automated):** `npx vitest backend/tests/unit/ai/tools/handlers/` passes 100%. (PASSED)

> [!IMPORTANT]
> **BREAK FOR MANUAL VERIFICATION #1 (Handlers Smoke Test):**
> Run `npx tsx backend/scripts/test-investigative-tools.ts` against synthetic data fixture. Verify that all 10 tools return lean JSON payloads under 50ms without unhandled exceptions.

---

### Phase 3: Gemini Chat Tool Loop & API Route Integration

- [x] **Task 13: Multi-Turn Gemini Tool Execution Loop**
  - [x] **13.1 (TDD Red):** Unit tests in `backend/tests/unit/ai/gemini_tool_loop.test.ts`:
    - Mocking Gemini SDK: turn 1 `functionCalls` -> dispatch -> turn 2 final answer.
    - Safety bound enforcement: maximum 3 tool iterations to prevent infinite loops.
    - Fallback on tool timeout or failure.
    - Enforcement of "No Units in Speech" prompt rule (naked numbers). (PASSED)
  - [x] **13.2 (TDD Green):** Update `generateChatResponse()` in `backend/src/lib/ai/gemini.ts` to attach `COACH_INVESTIGATIVE_TOOLS` and execute iterative function responses. (PASSED)
- [x] **Task 14: Journal Route Integration**
  - [x] **14.1 (TDD Red):** Integration tests in `backend/tests/integration/journalChatRoutes.test.ts`:
    - Calling `POST /api/journals/:id/clusters/:clusterId/chat` triggers tool execution when asked about historical context.
    - Extracts Nightscout credentials, decrypts token, derives timezone from cluster. (PASSED)
  - [x] **14.2 (TDD Green):** Wire `ToolExecutionContext` and `nsClient` in `POST /:id/clusters/:clusterId/chat` in `backend/src/routes/journal.ts`. (PASSED)
  - **Verification Gate (Automated):** `npm run test:backend:ai` passes 100%. (PASSED)

> [!IMPORTANT]
> **BREAK FOR MANUAL VERIFICATION #2 (Live Voice Negotiation Check):**
> Start the dev server (`npm run dev`). Open Quick Coach at `http://localhost:5173/coach/:journalId`. Ask via voice: _"How did my blood sugar look on other mornings this week?"_ Check server logs to see `compare_recurring_time_window` dispatched and listen to TTS spoken reply with clean naked numbers.

---

### Phase 4: Local Blood Glucose Snapshot Persistence (Zero-Latency Fast Path)

- [x] **Task 15: Schema Migration for Journal Blood Glucose**
  - [x] **15.1:** Add `bloodGlucose Json?` to `model Journal` in `backend/prisma/schema.prisma`. (PASSED)
  - [x] **15.2:** Run Prisma migration (`npx prisma migrate dev --name add_journal_blood_glucose`) and rebuild packages (`npm run build:packages`). (PASSED)
- [x] **Task 16: Worker Glucose Snapshot Storage**
  - [x] **16.1 (TDD Red):** Unit tests in `backend/tests/unit/worker/glucose_persistence.test.ts` verifying that `worker.ts` trims and persists compact CGM entries (`[{ date, sgv, direction }]`). (PASSED)
  - [x] **16.2 (TDD Green):** Update `backend/src/worker.ts` to store `bloodGlucose` snapshot on journal completion. (PASSED)
- [x] **Task 17: Local-First Fast Path in Tool Handlers**
  - [x] **17.1 (TDD Red/Green):** Update `dispatcher.ts` and tool handlers to read from `journal.bloodGlucose` when requested time window is within the journal week, bypassing Nightscout HTTP calls. (PASSED)
  - **Verification Gate (Automated):** Full regression test suite `npm test` passes across monorepo. (PASSED)

> [!IMPORTANT]
> **BREAK FOR MANUAL VERIFICATION #3 (End-to-End Speed & Persistence Check):**
>
> 1. Run `npm run trigger:coaching -- --email=...` to generate a fresh journal.
> 2. Verify in SQLite database that `bloodGlucose` column contains the compact snapshot.
> 3. Chat with the coach in UI: verify sub-second response time with 0 network calls to Nightscout for coaching-week queries.
