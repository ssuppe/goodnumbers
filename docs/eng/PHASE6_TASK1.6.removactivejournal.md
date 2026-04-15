# **Goodnumbers \- Unrestricted Journaling & Processing State — todo.md**

## **TL;DR**

Remove the 3-day lockout logic, implement a dedicated "Processing" state for pending journals in the Hero card, and filter pending journals out of the history list to ensure a clean UI.

## **Invariants (do not change)**

1. **Creation Availability**: The "Start Journal" action must be available regardless of the timestamp of previous completed journals.
2. **List Integrity**: The "Past Journals" list must **never** show incomplete/pending journals (avoids broken UI rows).
3. **Processing Feedback**: Users must clearly see when a journal is being generated server-side via a spinner/message in the Hero card.
4. **Blocking State**: A user cannot start _another_ journal while one is currently PENDING.

## **Assumptions & Scope**

- **Assumption**: A journal is defined as "Processing" if its status field is 'PENDING'.
- **Assumption**: The backend POST /journals endpoint already allows creation without frequency limits (Verified).
- **Scope**: frontend/src/pages/DashboardPage.tsx, frontend/src/components/dashboard/StartJournalCard.tsx, and backend/src/routes/journal.ts.

## **Objectives**

1. **Enable Anytime Creation**: Remove differenceInDays lockout logic completely.
2. **Handle Processing State**: If a journal is PENDING, show a spinner in the Hero card and hide the "Start" button.
3. **Clean History**: Ensure PENDING journals do not appear in the PastJournalsList.
4. **Backend Sync**: Ensure frontend receives the status field for all journals.

## **Risks & Mitigations**

- **Risk**: User gets stuck on "Processing" state indefinitely if the browser doesn't refresh or poll.
  - _Mitigation_: Add a subtle "Refresh page to check status" hint text in the processing UI.
- **Risk**: Backend fails to return status, causing frontend to treat pending journals as complete (rendering empty rows).
  - _Mitigation_: Step 1 of the plan explicitly adds status: true to the Prisma select clause in the backend.

## **Method Outline**

1. **Backend Update**: Modify GET /journals to return the status field.
2. **Frontend Types**: Update JournalSummary interface to include status.
3. **Component Refactor (TDD)**:
   - Update StartJournalCard to handle isProcessing prop and remove locked logic.
   - Update DashboardPage to filter PENDING items and calculate props.

## **Implementation Notes**

### **Backend**

- **backend/src/routes/journal.ts**: Update the GET / handler's Prisma select object to include status: true.

### **Frontend**

- **StartJournalCard.tsx**:
  - **Props**: Add isProcessing (boolean). Remove activeDraftId, isEnabled, latestJournalDate.
  - **UI**: If isProcessing is true, render a large Spinner and "Journal Processing..." text. Remove all "Locked" (3-day) UI logic.
- **DashboardPage.tsx**:
  - **Logic**:  
    TypeScript  
    const pendingJournal \= journals.find(j \=\> j.status \=== 'PENDING');  
    const historyJournals \= journals.filter(j \=\> j.status \!== 'PENDING');

  - **Render**: Pass historyJournals to the list. Pass \!\!pendingJournal to the card's isProcessing prop.

## **Acceptance Gates**

- \[ \] Backend GET /journals response includes "status": "PENDING".
- \[ \] When a journal is pending, StartJournalCard shows the processing state (Spinner).
- \[ \] When a journal is pending, it does **not** appear in the "Past Journals" list.
- \[ \] When no journal is pending, "Start Journal" is available (even if last journal was 1 min ago).
- \[ \] DashboardPage no longer uses differenceInDays or date-fns.

## **"Make-sure-you" Checklist**

- \[ \] Did you update the Backend select clause? (Crucial, or frontend checks will fail).
- \[ \] Did you update the TypeScript interface JournalSummary?
- \[ \] Did you verify that the "Processing" state blocks the creation of _another_ journal?
- \[ \] Did you remove the date-fns imports from the component files?

## **Project hygiene prep**

1. **Branch**: git checkout \-b feat/unrestricted-journaling
2. **Issue**: Create issue "Refactor dashboard for unrestricted access and pending states".
3. **Baseline**: Run npm test to ensure green state before starting.

## **In-depth test plan (TDD Focus)**

### **1\. StartJournalCard (Unit)**

- **RED (Write these tests first)**:
  - it("renders processing state correctly"): Pass isProcessing={true}. Expect text "Your journal entry is being created" and a loader. Expect "Start Journal" button to be absent.
  - it("renders default enabled state"): Pass isProcessing={false}. Expect "Start Journal" button.
- **Refactor**: Remove old tests for "disabled state" and "continue journal state".

### **2\. DashboardPage (Integration)**

- **RED (Write these tests first)**:
  - it("filters pending journals from history list"): Mock API returning one PENDING and one COMPLETE journal. Expect PastJournalsList to receive list of length 1\.
  - it("passes isProcessing=true to card when pending journal exists"): Mock API with PENDING journal. Expect StartJournalCard to receive isProcessing={true}.
- **Refactor**: Remove old tests regarding "3-day lockout" or "active draft filtering".

## ---

**In-depth engineering plan**

### **Step 1: Backend Update (Prerequisite)**

1. **Action**: Open backend/src/routes/journal.ts.
2. **Action**: In the router.get('/', ...) handler, find the select object.
3. **Action**: Add status: true to the list of selected fields.
4. **Verify**: Run backend tests (npm test \-w backend).

### **Step 2: Update Frontend Types**

1. **Action**: Open frontend/src/types/dashboard.ts (or equivalent type definition file).
2. **Action**: Add status: string; to the JournalSummary interface.

### **Step 3: TDD \- StartJournalCard Component**

#### **3.1 RED: Update Tests**

1. Open frontend/src/components/dashboard/StartJournalCard.test.tsx.
2. **Delete** obsolete tests: "renders the disabled state correctly" and "renders the Continue Journal state".
3. **Add** new test case:  
   TypeScript  
   it("renders the processing state correctly", () \=\> {  
    render(\<StartJournalCard isProcessing\={true} isSubmitting\={false} error\={null} onClick\={mockFn} /\>);  
    expect(screen.getByText(/Your journal entry is being created/i)).toBeInTheDocument();  
    expect(screen.queryByRole("button", { name: /Start Journal/i })).not.toBeInTheDocument();  
   });

4. **Run Tests**: npm test frontend. **Expect FAIL** (TypeScript error: isProcessing prop does not exist).

#### **3.2 GREEN: Implement Logic**

1. Open frontend/src/components/dashboard/StartJournalCard.tsx.
2. **Update Interface**: Add isProcessing: boolean. Remove isEnabled, activeDraftId, latestJournalDate.
3. **Update Implementation**:
   - Remove date-fns and react-router-dom imports.
   - Add condition at top:  
     TypeScript  
     if (isProcessing) {  
      return (  
      \<section className="..."\>  
      {/\* Spinner and Processing Text \*/}  
      \<h2\>Journal Processing...\</h2\>  
      \<p\>Your journal entry is being created. Refresh page to check status.\</p\>  
      \</section\>  
      )  
     }

   - Simplify the main return: Remove the ternary (isEnabled ? ... : ...). Just render the "Reflect on your week" state.

4. **Run Tests**: npm test frontend. **Expect PASS**.

#### **3.3 REFACTOR: Cleanup**

1. Remove unused imports in StartJournalCard.tsx.
2. Ensure styling matches existing cards (padding, shadow, rounded-xl).

### **Step 4: TDD \- DashboardPage Logic**

#### **4.1 RED: Update Tests**

1. Open frontend/src/pages/DashboardPage.test.tsx.
2. **Delete** obsolete tests: "filters it from list if \< 3 days old".
3. **Update** mock data in existing tests: Add status: 'COMPLETE' to all mock journal objects.
4. **Add** new test case:  
   TypeScript  
   it("passes processing state to card and filters pending from list", async () \=\> {  
    const pending \= { id: '1', status: 'PENDING', ... };  
    const complete \= { id: '2', status: 'COMPLETE', ... };  
    (api.get as vi.Mock).mockResolvedValue({ data: \[pending, complete\] });

   render(\<DashboardPage /\>);  
    // ... wait for load

   // Verify List received only 1 item  
    expect(screen.getByTestId('past-journals-list')).toHaveTextContent('Length: 1');  
    // (Note: You may need to verify props on the mocked component depending on how the mock is set up)

   // Verify Card received isProcessing=true  
    // Check for the processing text defined in Step 3  
   });

5. **Run Tests**: npm test frontend. **Expect FAIL** (Dashboard passes incorrect props).

#### **4.2 GREEN: Implement Logic**

1. Open frontend/src/pages/DashboardPage.tsx.
2. **Remove Imports**: differenceInDays, date-fns.
3. **Refactor Body**:  
   TypeScript  
   // Inside component  
   const pendingJournal \= journals.find(j \=\> j.status \=== 'PENDING');  
   const historyJournals \= journals.filter(j \=\> j.status \!== 'PENDING');

4. **Update JSX**:  
   TypeScript  
   \<StartJournalCard  
    isProcessing={\!\!pendingJournal}  
    isSubmitting={isSubmitting}  
    error={creationError}  
    onClick={...}  
   /\>  
   \<PastJournalsList journals={historyJournals} /\>

5. **Run Tests**: npm test frontend. **Expect PASS**.

#### **4.3 REFACTOR: Cleanup**

1. Run linter.
2. Verify no unused variables (e.g., useMemo might be unneeded if logic is simple).
