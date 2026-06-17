# Engineering Plan: Collaborative AI Chat Insights

**Author:** Technical Lead  
**Status:** Approved Engineering Draft (Refined with right-panel design)  
**Date:** June 17, 2026

---

## 1. TL;DR

Refactor the glycemic event cluster reflection flow to utilize a right-side persistent chat panel. The manual notes input box (`CollapsingNoteArea`) remains fully visible on the cluster card. Clicking "💡 Help me reflect" slides out the chat drawer from the right edge of the screen, bound to that specific cluster card. The card itself receives a pulsing border highlight to link the two views. Clicking "Summarize my notes" in the drawer synthesizes the dialogue, inserts it into the note box of the active card with a brief green flash animation, and closes the drawer.

---

## 2. Technical Invariants & Assumptions

### Invariants

1. **Zero Database Migrations:** Transient chat history is held in client-side React state. The final synthesized note is saved in the existing `userNotes` column in the database.
2. **Strict TDD Workflow:** All updated route integrations and frontend components must have passing tests.
3. **Mesa Theme Compliance:** Frontend styles must use tokens from [index.css](file:///home/clark/dev/goodnumbers-clean/frontend/src/index.css) (Terracotta `#D9775B` for user bubbles and primary buttons, Petrol Blue `#2C4C5B` for AI Coach headers).
4. **Dynamic Context Re-mounting:** The chat drawer must listen to active cluster switches, clearing the previous chat history and fetching the starting prompt for the newly selected cluster.

---

## 3. Objectives & Risks

### Objectives

- Provide a seamless, multi-tasking UX where the user can view charts, write manual notes, and chat with the AI concurrently.
- Visually connect the floating chat panel with the main page cluster cards via border highlights and flash indicators.
- Maintain clean ESM imports and verify test correctness without any console noise (via `--silent`).

### Risks & Mitigations

- **Layout Overflow:** Floating sidebar overlaying content. **Mitigation:** Use responsive tailwind sizing (`w-[380px] sm:w-[420px]`) and slide transitions, keeping the drawer on top of other content (`z-50`).

---

## 4. Implementation Details & Architecture

### State Lifting & Props Flow

- **`JournalPage.tsx`:**
  - Tracks `activeChatClusterId: string | null` state.
  - Renders `ClusterChatInterface` as a fixed right-side drawer when `activeChatClusterId` is non-null.
  - Injects `onSaveInsight` handler which updates `formData.clusterNotes[clusterId]` and closes the drawer.
- **`EventClusterCard.tsx`:**
  - Receives `isChatActive: boolean` (true if `activeChatClusterId === cluster.id`).
  - Receives `onHelpReflect: () => void` callback.
  - Renders standard `CollapsingNoteArea` and a `"Help me reflect"` button.
  - Animates a pulsing border outline if `isChatActive` is true.
  - Animates a brief green flash on the notes area when the summary is pasted.

---

## 5. Task-by-Task Implementation Plan

### Task 4: Refactor Chat UI to Right-Side Drawer

Transform `ClusterChatInterface.tsx` into a fixed right-side AIM-style chat panel.

- **Step 4.1:** Modify `ClusterChatInterface.tsx`:
  - Update wrapper class to use a fixed right layout: `fixed right-0 top-0 h-screen w-[380px] sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col`.
  - Style the header to display AI Reflection Coach status and close button (`X`).
  - Style the bottom button to read `"Summarize my notes"`.
  - Ensure the message feed handles high-density text balloons (AI messages are Petrol Blue, User messages are solid Terracotta).
- **Step 4.2:** Update unit tests in `frontend/src/components/journal/__tests__/ClusterChatInterface.test.tsx` to match the updated button name (`Summarize my notes`) and close button behavior.
- **Verification (TDD):**
  - Run `npm test -w frontend -- src/components/journal/__tests__/ClusterChatInterface.test.tsx` to verify all unit assertions pass.

---

### Task 5: Integrate Hybrid Flow in Parent Page and Cluster Cards

Update `JournalPage` and `EventClusterCard` to manage the sidebar lifecycle and highlighting.

- **Step 5.1:** Update `JournalPage.tsx`:
  - Add state `activeChatClusterId` initialized to `null`.
  - Render `ClusterChatInterface` as a sidebar if `activeChatClusterId` is active.
  - In the mapping of cluster cards, pass `isChatActive={activeChatClusterId === cluster.id}` and `onHelpReflect={() => setActiveChatClusterId(cluster.id)}`.
  - Pass an `onSaveInsight` callback to the chat drawer to update `formData.clusterNotes[activeChatClusterId]` and set `activeChatClusterId` back to `null`.
- **Step 5.2:** Update `EventClusterCard.tsx`:
  - Remove the local `isChatActive` state.
  - Keep standard notes `CollapsingNoteArea` always rendered.
  - Render `"💡 Help me reflect"` button next to or below the note area.
  - Add a border outline/ring to the card wrapper if `isChatActive` is true (`ring-2 ring-mesa-primary shadow-lg`).
  - Add a local state `shouldFlash` that triggers a brief green flash on the note area when the notes value changes via summary paste.
- **Step 5.3:** Update `EventClusterCard.test.tsx` to reflect these changes:
  - Remove obsolete tests testing old local toggling logic.
  - Add new tests verifying that `onHelpReflect` is called when clicking "Help me reflect".
  - Verify that the active border class is applied when `isChatActive` is true.
- **Verification (TDD):**
  - Run `npm test -w frontend -- src/components/journal/EventClusterCard.test.tsx` to verify all unit assertions pass.

---

## 6. Acceptance Gates & Verification Checklist

- [ ] **Drawer UI:** The chat drawer slides in cleanly on the right hand side when clicking "Help me reflect".
- [ ] **Notes Card Visibility:** The cluster notes card and chart remain fully visible and editable during chat.
- [ ] **Context Switching:** Clicking "Help me reflect" on a different cluster card correctly resets and switches the active chat session in the drawer.
- [ ] **Summary Paste:** Clicking "Summarize my notes" compiles the history, updates the card note area, flashes the outline green, and closes the drawer.
- [ ] **Full TDD Pass:** All workspace tests run and pass without errors (`npm run test:ai` / `npm run test:frontend:ai`).
