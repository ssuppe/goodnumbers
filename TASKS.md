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
