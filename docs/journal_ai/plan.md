# Engineering Plan: Collaborative AI Chat Insights

**Author:** Technical Lead  
**Status:** Approved Engineering Draft  
**Target File:** `docs/eng/plan.md`  
**Date:** June 16, 2026

---

## 1. TL;DR

Overhaul the glycemic event cluster reflection UX by replacing the static note text area with a hybrid note-entry system. Users can type manually or click "Help me reflect" to engage in a transient chat session with an AI Reflection Coach. The chat is initialized with a cluster-specific dynamic starting prompt. Clicking "Save as Insight" synthesizes the conversation into a formatted POV summary and action items, which are written back to the cluster's `userNotes` column in the database.

---

## 2. Technical Invariants & Assumptions

### Invariants

1. **Zero Database Migrations:** Transient chat history is held in client-side state. The synthesized note is stored in the existing `userNotes` JSON column. The dynamic starting prompt is stored within the existing `aiInsight` JSON column. No database schema changes are made.
2. **Strict TDD Workflow:** All backend routes and LLM prompts must have associated test cases (using Supertest for integrations and Vitest for unit tests). No code is declared complete without a passing test suite.
3. **Medical Safety Compliance:** The AI coach must never prescribe dosages, recommend medication adjustments, or give medical diagnoses. It must use observational language and direct the patient to consult their clinical team.
4. **No HTML Injection:** Gemini responses must be stripped of HTML characters, and frontend rendering must use standard React escaping.

### Assumptions

- The frontend uses Tailwind CSS v4 and the predefined Mesa theme tokens.
- ECharts rendering of cluster events remains unchanged.
- The backend is running Express with Auth.js middleware verifying `req.user`.

---

## 3. Objectives & Risks

### Objectives

- Provide a high-fidelity conversational coaching experience tailored to the patient's hourly glucose and insulin patterns.
- Keep server memory consumption low by avoiding database storage of transient chat transcripts.
- Preserve existing downstream consumers (such as RSS podcast generation) by writing the final output back to the `userNotes` column.

### Risks & Mitigations

- **Gemini API Latency/Failure:** Chat operations might lag. **Mitigation:** Implement client-side loading states (pulsing skeleton & typing indicators) and fallback gracefully if the API fails.
- **Context Drift:** The AI could stray from the cluster topic. **Mitigation:** System prompt injection forces the model to focus strictly on the cluster's times, timezone, and deterministic findings.

---

## 4. Implementation Notes

### Data Contracts

We will expand the existing `AiInsight` types to include the dynamic starting prompt:

```typescript
// Shared Types & Frontend Contracts
export interface AiInsight {
  assessment: string;
  reflectionForDoctor?: string;
  quickLogSuggestions?: string[];
  initialPrompt?: string; // New field populated on journal generation
}
```

### LLM Prompt Architecture

We will introduce two new prompts in `backend/src/lib/ai/prompts.ts`:

1. **`CLUSTER_AI_CHAT_PROMPT`:** Sets the system role for the empathetic coach. Receives the cluster data, deterministic insights, weekly vibe/factors, and the active chat history.
2. **`CLUSTER_AI_SYNTHESIS_PROMPT`:** Takes the chat history and outputs a structured summary block:
   ```markdown
   > "[POV Summary of findings]"

   - **Resolution 1:** [Action item 1]
   - **Resolution 2:** [Action item 2]
   ```

---

## 5. Task-by-Task Implementation Plan

### Task 1: Update AI Insight Schema and Prompt Generator

Extend the worker's AI insight call to generate the dynamic `initialPrompt` during journal generation.

- **Step 1.1:** Update `AiInsight` types in `frontend/src/components/journal/EventClusterCard.tsx` and the corresponding types in the backend.
- **Step 1.2:** Update `CLUSTER_AI_INSIGHT_PROMPT` in `backend/src/lib/ai/prompts.ts` to request an additional `initial_prompt` field in the JSON structure.
- **Step 1.3:** Update `generateClusterAIInsight` in `backend/src/lib/ai/gemini.ts` to parse `initial_prompt` from the Gemini response and include it as `initialPrompt` in the return object.
- **Verification (TDD):**
  - Run: `npm run test:ai` or `npx vitest backend/tests/integration/worker/ai_insights.test.ts` to verify the generator correctly returns `initialPrompt`.

---

### Task 2: Implement Chat and Synthesis Services

Add backend handler functions that call the Gemini API for conversational replies and final notes synthesis.

- **Step 2.1:** Create `generateChatResponse` in `backend/src/lib/ai/gemini.ts`:
  ```typescript
  export async function generateChatResponse(
    cluster: GlycemicCluster,
    chatHistory: { role: "user" | "model"; content: string }[],
    newMessage: string,
  ): Promise<string>;
  ```
- **Step 2.2:** Create `synthesizeChatInsight` in `backend/src/lib/ai/gemini.ts`:
  ```typescript
  export async function synthesizeChatInsight(
    chatHistory: { role: "user" | "model"; content: string }[],
  ): Promise<string>;
  ```
- **Verification (TDD):**
  - Create unit tests in `backend/tests/unit/ai/gemini_chat.test.ts` mocking Gemini and verifying that the correct prompt outputs are returned. Run: `npx vitest backend/tests/unit/ai/gemini_chat.test.ts`

---

### Task 3: Expose API Routes

Add Express endpoints for handling chat and synthesis requests.

- **Step 3.1:** Add the routes to `backend/src/routes/journal.ts`:
  - `POST /:id/clusters/:clusterId/chat`
    - Retrieves the cluster from the database, extracts its context, calls `generateChatResponse`, and returns the reply.
  - `POST /:id/clusters/:clusterId/save-insight`
    - Receives the transient chat transcript, calls `synthesizeChatInsight`, and returns the synthesized markdown text.
- **Verification (TDD):**
  - Create integration tests in `backend/tests/integration/journalChatRoutes.test.ts` using `supertest` to hit these endpoints and assert response structures. Run: `npx vitest backend/tests/integration/journalChatRoutes.test.ts`

---

### Task 4: Build Frontend Chat Component

Create the conversational UI component in the frontend.

- **Step 4.1:** Create `frontend/src/components/journal/ClusterChatInterface.tsx`:
  - Props: `initialPrompt: string`, `onSaveInsight: (synthesizedText: string) => void`, `onClose: () => void`.
  - Manage local `chatHistory` state: `messages: { role: 'user' | 'model'; content: string }[]`.
  - Implement scroll-to-bottom effects and a typing indicator while awaiting API resolution.
  - Use brand styles: `bg-blue-50/70`, `text-mesa-text`, `bg-mesa-primary`, `hover:bg-primary-hover`.
- **Step 4.2:** Write component tests in `frontend/src/components/journal/__tests__/ClusterChatInterface.test.tsx` using React Testing Library to verify messaging and saving triggers.
- **Verification (TDD):**
  - Run: `npx vitest frontend/src/components/journal/__tests__/ClusterChatInterface.test.tsx`

---

### Task 5: Integrate Hybrid Flow in EventClusterCard

Connect the new chat component into the existing card structure.

- **Step 5.1:** Update `EventClusterCard.tsx` to handle a local `isChatActive` state.
- **Step 5.2:** Render the "💡 Help me reflect" button underneath `CollapsingNoteArea`. When clicked, set `isChatActive` to true.
- **Step 5.3:** When `isChatActive` is true, render `ClusterChatInterface` in place of the `CollapsingNoteArea`.
- **Step 5.4:** On `onSaveInsight`, set `isChatActive` to false and trigger the existing `onNoteChange` callback with the synthesized text.
- **Verification (TDD):**
  - Update `EventClusterCard.test.tsx` to assert that clicking "Help me reflect" hides the text area and displays the chat bubbles. Verify that clicking "Save as Insight" closes the chat and calls `onNoteChange`. Run: `npx vitest frontend/src/components/journal/EventClusterCard.test.tsx`

---

## 6. Acceptance Gates & Verification Checklist

- [ ] **Data Structure:** AI insight responses successfully return `initialPrompt` fields.
- [ ] **Backend Tests:** Route integration tests pass and enforce Auth.js middleware constraints.
- [ ] **Prompt Safety:** Chat responses do not containing prescriptions or diagnostic mandates.
- [ ] **Frontend Integration:** Notes textarea correctly populates with synthesized text on save.
- [ ] **CSS & Styling:** Element colors adhere strictly to variables in `index.css`.
- [ ] **TDD Pass:** `npm run test` executes successfully across backend and frontend workspaces.
