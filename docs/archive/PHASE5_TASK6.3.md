# GoodNumbers — `phase5-task6.3-journal-editing.md` (Final Comprehensive Edition)

## TL;DR

Implement interactive editing for the Journal page, transforming it from a read-only view into a fully functional form. This involves building four specific high-fidelity UI components (`WeeklyVibe`, `InfluencingFactors`, `ContextualNotesArea`, `StickyActionBar`), wiring them to the backend API, and implementing robust security measures to prevent data loss. Finally, update the Dashboard to support resuming active drafts.

## Invariants (do not change)

- **AI Immutability:** AI-generated content (Podcast, AGP Chart, Insights) must **never** be editable by the user.
- **State Synchronization:** Local form state must be initialized strictly _after_ the asynchronous data fetch completes.
- **API Client:** All requests must use `src/lib/api.ts` to ensure CSRF token inclusion.
- **Type Safety:** All payloads must conform to `@goodnumbers/types` and `@goodnumbers/schemas`.
- **No Client-Side PHI Logging:** Never log the `formData` object or user inputs to the browser console, even during error handling, as this leaks Personal Health Information (PHI).
- **Standard Rendering:** All user input must be rendered using standard React value binding (e.g., `value={text}`). Never use `dangerouslySetInnerHTML`.

## Assumptions & Scope

- **Assumption:** `JournalPage` (Task 6.2) exists and correctly fetches/renders read-only data.
- **Assumption:** The backend endpoint `PUT /api/journals/:id` is fully implemented.
- **Scope:**
  - Implementing `WeeklyVibeSelector` (V3 Design).
  - Implementing `InfluencingFactors` (V3 Design).
  - Implementing `ContextualNotesArea` (V3 Design) for "Goals".
  - Implementing `StickyActionBar` (V3 Design).
  - Refactoring `ClusterCard` to allow editing of user notes.
  - Wiring up the "Save" and "Delete" functionality.
  - **Security Scope:** Implementing robust error handling to prevent data loss on session expiry and enforcing input length limits.
  - **Dashboard Scope:** Updating the dashboard to show a "Continue Journal" state for active drafts.
- **Out of Scope:** Modifications to the AGP Chart, Podcast Player, or Insight generation logic.

## Objectives

1.  **Interactive Inputs:** Replace placeholder components with high-fidelity, interactive V3 designs.
2.  **State Management:** Implement local state to track dirty changes before saving.
3.  **Persistence:** Wire the "Save" button to `PUT /api/journals/:id`.
4.  **Deletion:** Wire the "Delete" button to `DELETE /api/journals/:id` with a confirmation dialog.
5.  **Feedback:** Provide immediate visual feedback for "Saving..." and error states.
6.  **Data Safety:** Ensure user input is preserved in the UI if the save operation fails (e.g., due to network error or session timeout).
7.  **Resume Capability:** Allow users to easily resume an active journal draft from the dashboard.

## Risks & Mitigations

- **Risk:** **Data Structure Mismatch (Clusters).** The API returns `clusters` as an Array, but the `PUT` endpoint expects `clusterNotes` as a `Record<string, string>` (Map).
  - **Mitigation:** Explicitly transform the array to a map during state initialization (see Implementation Notes).
- **Risk:** **Data Loss via Navigation.** User navigates away with unsaved changes.
  - **Mitigation:** The "Sticky Action Bar" is persistently visible.
- **Risk:** **Data Loss on Auth Failure.** User session expires while writing; Save returns `401 Unauthorized`; App redirects to login, destroying unsaved data.
  - **Mitigation:** The `handleSave` error handler must **not** navigate away or clear the form on failure. It must display a persistent error alert and keep the dirty state active so the user can copy/rescue their text.
- **Risk:** **Unbounded Input.** User enters massive amounts of text, causing payload issues or UI lag.
  - **Mitigation:** Enforce `maxLength` attributes on all text areas.

## Method Outline

1.  **API Extension:** Add `updateJournal` and `deleteJournal` methods to the frontend API client.
2.  **Component Implementation:** Build the four new components (`WeeklyVibe`, `InfluencingFactors`, `ContextualNotesArea`, `StickyActionBar`) following their specific design docs.
3.  **Page Logic:** Lift state from individual components to `JournalPage`. Implement the `reduce` logic to map cluster arrays to the notes object.
4.  **Integration:** Replace the placeholders in `JournalPage` with the new components and wire up the state.
5.  **Security Integration:** Apply input limits and robust error handling logic.
6.  **Dashboard Update:** Implement the "Continue Journal" logic.

## Implementation Notes

### 1. API Payload Transformation

The frontend state must be transformed before sending to `PUT /api/journals/:id`.

```typescript
// Expected Payload Structure for API
interface UpdateJournalPayload {
  weeklyVibe?: string;
  influencingFactors?: string[]; // Ensure this is sent as array, not null
  goalsForNextWeek?: string;
  clusterNotes?: Record<string, string>; // Key: Cluster ID, Value: Note
}
```

### 2. State Initialization Logic

Do not initialize state directly in `useState` with potentially null data. Use a `useEffect` or conditional rendering.

```typescript
// Inside JournalPage component
const [formData, setFormData] = useState<JournalFormData | null>(null);

useEffect(() => {
  if (journalData) {
    setFormData({
      weeklyVibe: journalData.weeklyVibe,
      influencingFactors: (journalData.influencingFactors as string[]) || [],
      goalsForNextWeek: journalData.goalsForNextWeek,
      // CRITICAL: Transform Array to Map for local editing state
      clusterNotes: journalData.clusters.reduce(
        (acc, cluster) => ({
          ...acc,
          [cluster.id]: cluster.userNotes || "",
        }),
        {} as Record<string, string>,
      ),
    });
  }
}, [journalData]);
```

### 3. Security & Constraints

- **Input Limits:**
  - **Goals (ContextualNotesArea):** Apply `maxLength={2000}`.
  - **Cluster Notes:** Apply `maxLength={1000}`.
- **Privacy Logging:** In the `handleSave` catch block, do **not** log the `formData` object to the console. Log only the error message string or status code.
- **Error Handling:** If the API call fails, set a local `saveError` state string. Display this error prominently (e.g., in the Sticky Action Bar or a toast). **Do not redirect.**

## Acceptance Gates

- [ ] **Vibe:** User can select 1 vibe; visual state updates with V3 styling (ring, background).
- [ ] **Factors:** User can toggle multiple factors; chips animate and show checkmarks.
- [ ] **Notes:** "On reflection..." area expands on focus and collapses on blur (if empty).
- [ ] **Constraints:** User cannot type more than 2000 chars in Goals or 1000 chars in Cluster Notes.
- [ ] **Save:** Clicking "Save" triggers `PUT`. Button shows "Saving..." spinner. Success redirects to Dashboard.
- [ ] **Error Safety:** If Save fails (e.g., network error), the form data remains visible and editable. An error message is shown.
- [ ] **Delete:** Clicking "Delete" shows confirmation. Confirm triggers `DELETE`. Success redirects to Dashboard.
- [ ] **Dashboard:** If a journal exists for the current week, the main card shows "Continue Journal" and links to the edit page.

## Project hygiene prep

- **Branch:** `feat/phase5-task6.3-journal-editing`
- **Base:** `phase5develop`
- **Test Command:** `npm test -w frontend`

## In-depth test plan

### Unit/Integration Tests (`frontend/src/pages/JournalPage.test.tsx`)

1.  **Initialization:** Mock `useJournal` hook. Assert `formData` is initialized correctly from the mock data.
2.  **Interaction:**
    - Fire `click` on a Vibe card -> Assert state update.
    - Fire `change` on Goals textarea -> Assert state update.
    - Fire `click` on Factor chip -> Assert item added/removed from array.
3.  **Save Flow:**
    - Mock `api.updateJournal`.
    - Click "Save".
    - Assert `api.updateJournal` is called with the correct payload.
    - Assert button text changes to "Saving...".
4.  **Error Handling (Data Safety):**
    - Mock a `500` or `401` error from `api.updateJournal`.
    - Click "Save".
    - Assert that the **Form Data remains visible** (textareas are not cleared).
    - Assert that an error message is displayed in the document.
    - Assert that `mockNavigate` was **not** called.

## In-depth engineering plan

### Step 1: Update API Client (TDD)

1.  **Red (Test):** Create `frontend/src/lib/api.test.ts` (if not exists). Add a test case for `updateJournal` and `deleteJournal`. Mock `axios` and assert that calling these functions sends the correct HTTP method (`PUT`, `DELETE`) and payload to the correct URL.
2.  **Green (Impl):** Update `frontend/src/lib/api.ts`.
    - Export `updateJournal(id, payload)`.
    - Export `deleteJournal(id)`.
    - Ensure types match `@goodnumbers/types`.

### Step 2: Implement `WeeklyVibeSelector` (TDD)

**Reference:** `docs/design/weekly-vibe-v3.md`

1.  **Red (Test):** Create `frontend/src/components/journal/WeeklyVibeSelector.test.tsx`.
    - Test that it renders 4 options.
    - Test that passing `selectedVibe="Sprouting"` applies the active classes (`bg-blue-100`, `ring-4`).
    - Test that clicking a card calls `onChange` with the correct string.
2.  **Green (Impl):** Create `frontend/src/components/journal/WeeklyVibeSelector.tsx`.
    - **Data:** Define the `vibeOptions` array locally (Wilted, Sprouting, Growing, Flourishing).
    - **Styling:** Use `grid-cols-2 md:grid-cols-4`.
    - **Interaction:** Implement the `onClick` handler.
    - **Micro-interaction:** Add `group` to parent and `group-hover:rotate-6` to the emoji.

### Step 3: Implement `InfluencingFactors` (TDD)

**Reference:** `docs/design/influencing-factors.md`

1.  **Red (Test):** Create `frontend/src/components/journal/InfluencingFactors.test.tsx`.
    - Test that it renders chips from the `FACTOR_OPTIONS` list.
    - Test that passing `selectedFactors=["Busy"]` renders the "Busy" chip with `bg-blue-600` and a checkmark icon.
    - Test that clicking an unselected chip calls `onChange` with the new item added.
    - Test that clicking a selected chip calls `onChange` with the item removed.
2.  **Green (Impl):** Create `frontend/src/components/journal/InfluencingFactors.tsx`.
    - **Data:** Define `FACTOR_OPTIONS` array locally.
    - **Logic:** Implement `handleToggle` to add/remove from array.
    - **Styling:** Use `flex flex-wrap gap-3`, `rounded-full`.
    - **Micro-interaction:** Add `hover:scale-[1.05]` to inactive chips.

### Step 4: Implement `ContextualNotesArea` (TDD)

**Reference:** `docs/design/on-reflection.md`

1.  **Red (Test):** Create `frontend/src/components/journal/ContextualNotesArea.test.tsx`.
    - Test that it initially renders as an `input` (collapsed) if value is empty.
    - Test that focusing the input transforms it into a `textarea` (expanded).
    - Test that it renders a `textarea` immediately if value is present.
    - **Security Test:** Verify `maxLength` is 2000.
2.  **Green (Impl):** Create `frontend/src/components/journal/ContextualNotesArea.tsx`.
    - **State:** `isExpanded` (boolean).
    - **Refs:** `useRef` for the textarea to manage focus.
    - **Effect:** `useEffect` to call `.focus()` when `isExpanded` becomes true.
    - **Logic:** `onBlur` should set `isExpanded(false)` only if content is empty (use a small timeout).
    - **Security:** Add `maxLength={2000}`.

### Step 5: Implement `StickyActionBar` (TDD)

**Reference:** `docs/design/sticky-action-bar.md`

1.  **Red (Test):** Create `frontend/src/components/journal/StickyActionBar.test.tsx`.
    - Test it renders "Discard" and "Save" buttons.
    - Test `isLoading={true}` disables buttons and shows "Saving..." spinner.
    - Test clicking "Save" calls `onSave`.
    - Test clicking "Discard" calls `onDiscard`.
2.  **Green (Impl):** Create `frontend/src/components/journal/StickyActionBar.tsx`.
    - **Styling:** `fixed bottom-0 left-0 right-0 z-40 bg-white shadow-xl`.
    - **Props:** `onSave`, `onDiscard`, `isLoading`, `error`.
    - **Error Display:** If `error` prop is present, render it in red text above the buttons.

### Step 6: Refactor `ClusterCard` (TDD)

1.  **Red (Test):** Update `frontend/src/components/journal/EventClusterCard.test.tsx`.
    - Test that a textarea is rendered for user notes.
    - Test that typing calls `onNoteChange`.
    - **Security Test:** Verify `maxLength` is 1000.
2.  **Green (Impl):** Update `frontend/src/components/journal/EventClusterCard.tsx`.
    - Add props: `userNote: string`, `onNoteChange: (note: string) => void`.
    - Render a simple textarea below the cluster visualization (or placeholder).
    - Add `maxLength={1000}`.

### Step 7: Integrate Logic into `JournalPage` (TDD)

1.  **Red (Test):** Update `frontend/src/pages/JournalPage.test.tsx`.
    - Mock the API response.
    - Test that `formData` state is initialized correctly.
    - Test that calling the save handler triggers the API with the transformed payload.
    - **Security Test:** Mock a failure response from `api.updateJournal`. Assert that the `saveError` state is set and the form is **not** cleared/navigated away from.
2.  **Green (Impl):** Update `JournalPage.tsx`.
    - **Imports:** Import the 4 new components.
    - **State:** Add `useState` for `formData` and `saveError`.
    - **Effect:** Add `useEffect` to populate state when data loads.
    - **Handlers:**
      - `handleVibeChange(vibe)`
      - `handleFactorChange(factors)`
      - `handleGoalChange(text)`
      - `handleClusterNoteChange(id, text)`
    - **Save Logic:**
      ```typescript
      const handleSave = async () => {
        try {
          setSaveError(null);
          setIsSaving(true);
          // Transform formData to API payload
          await api.updateJournal(id, payload);
          navigate("/dashboard");
        } catch (err) {
          // PRIVACY: Do NOT log formData here.
          console.error("Failed to save journal:", err);
          setSaveError("Failed to save. Please try again.");
          // Do NOT navigate. Keep user on page.
        } finally {
          setIsSaving(false);
        }
      };
      ```
    - **Render:**
      - Replace old placeholders with new components.
      - Pass `formData` values and handlers to each component.
      - Render `StickyActionBar` at the bottom.
      - Add `pb-24` to the main container to prevent overlap.

### Step 8: Enhance Dashboard with "Continue Journal" State (TDD)

1.  **Red (Test):** Update `frontend/src/pages/DashboardPage.test.tsx`.
    - Test that if the most recent journal is < 3 days old, the `StartJournalCard` receives a prop (e.g., `activeDraftId`) pointing to it.
    - Test that this active draft is **filtered out** of the `PastJournalsList`.
2.  **Green (Impl):** Update `DashboardPage.tsx`.
    - Implement logic to check `differenceInDays` on the first journal.
    - If active, pass its ID to `StartJournalCard` and slice the list passed to `PastJournalsList`.
3.  **Red (Test):** Update `frontend/src/components/dashboard/StartJournalCard.test.tsx`.
    - Test that if `activeDraftId` is present, the card renders "Finish your reflection" and a "Continue Journal" button linking to `/journal/:id`.
4.  **Green (Impl):** Update `StartJournalCard.tsx` to handle this new state.

### Step 9: Final Verification

- Run `npm test -w frontend`.
- **Manual Check:**
  - Navigate to a journal.
  - Verify Vibe cards hover/rotate.
  - Verify Factor chips toggle and show checkmarks.
  - Verify "On reflection..." expands on click.
  - Disconnect network -> Click Save -> Verify error message and data persistence.
  - Reconnect -> Click Save -> Verify redirect.
  - **Dashboard Check:** Verify that after starting a journal and navigating back, the dashboard shows "Continue Journal" and the journal is NOT in the past list.
