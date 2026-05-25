Of course. Here is the final, complete, and detailed engineering plan for `docs/eng/PHASE5_TASK5.3.md`, incorporating all the changes and improvements we have discussed.

I have added a new, comprehensive test for the Account Setup Page, included a clarifying comment in the backend code, and added a final step to fix the `lint-staged` configuration. The rest of the plan remains intact to ensure a junior engineer can follow it step-by-step.

---

# Goodnumbers — Phase 5, Task 5.3 (Revised for Security & Completeness)

## TL;DR

Implement the UI and API logic for the user Agreements and Account Setup pages to complete the mandatory onboarding flow, ensuring the form correctly handles both initial setup and subsequent editing of user settings.

## Invariants (do not change)

- All client-side navigation must use components and hooks from `react-router-dom`.
- All state-modifying API requests (`PUT`, `POST`, `DELETE`) **must** be sent via the centralized `axios` instance from `frontend/src/lib/api.ts` to ensure proper CSRF token handling.
- All new components and pages must be covered by passing unit and integration tests using Vitest and React Testing Library.
- Successful completion of the final setup step must redirect the user to `/dashboard`.
- The backend **must not** send the full `nightscoutToken` to the client-side session.

## Assumptions & Scope

- **Assumption:** The backend development server is running and the following endpoints are available and functional: `GET /api/session`, `GET /api/csrf-token`, and `PUT /api/user/settings`.
- **Assumption:** The `AuthProvider` and `useAuth` hook are correctly configured to provide the authenticated user's state.
- **Scope:**
  - Update the backend `User` model and settings API to securely store a non-sensitive token hint.
  - Update the backend session callback to provide this non-sensitive data to the client.
  - Update the frontend auth context to consume this data.
  - Create a reusable `useApiForm` hook for handling form submission state.
  - Implement the full UI and client-side logic for `AgreementsPage.tsx`, leveraging the `useApiForm` hook.
  - Implement the full UI and client-side logic for `SetupPage.tsx`, leveraging the `useApiForm` hook.
- **Out of Scope:** The "Test Connection" button and its associated API call on the `SetupPage.tsx` are explicitly deferred.

## Objectives

1.  **Refactor Data Flow:** Update the backend and frontend to securely pass necessary, non-sensitive user settings (`nightscoutUrl`, `preferredUnits`, `nightscoutTokenLast3`) to the client-side session.
2.  **Implement Agreements Page:** Create a functional `AgreementsPage` that allows a user to agree to terms and privacy policies, persisting this choice to the backend.
3.  **Implement Setup/Settings Page:** Create a functional `SetupPage` that allows a user to input and save their settings, correctly pre-filling data when editing.
4.  **Connect Onboarding Flow:** Ensure that successfully completing the agreements page automatically navigates the user to the account setup page, and completing setup navigates to the dashboard.
5.  **Validate with Tests:** Ensure all new and modified logic is validated by a comprehensive suite of passing tests.

## Risks & Mitigations

- **Risk (Security):** The user's full Nightscout token could be exposed to the client or unnecessarily handled on the server.
  - **Mitigation (Revised):** The backend will be refactored to **never decrypt the token for UI purposes**. Instead, a non-sensitive hint (the last 3 characters) will be stored in a separate database field (`nightscoutTokenLast3`) at the time the token is set. The session callback will only ever read this safe, pre-calculated field, adhering to the Principle of Least Privilege.
- **Risk (Security):** The sensitive settings endpoint could be vulnerable to automated abuse or brute-force attacks.
  - **Mitigation (New):** A strict **rate limiter** will be applied specifically to the `PUT /api/user/settings` endpoint on the backend to prevent abuse.
- **Risk:** Form state and submission logic becomes duplicated and complex across pages.
  - **Mitigation:** A reusable `useApiForm` hook will be created to encapsulate the common logic for handling submission state (`isSubmitting`, `error`), promoting a DRY and more secure codebase.
- **Risk:** Navigation logic fires before an API call is complete, causing a race condition.
  - **Mitigation:** All navigation actions must be chained to the successful resolution of the API call promise (e.g., using `await` within an `async` function).

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Systematically refactor the backend data model for security, then implement a reusable form logic hook, and finally build the two required onboarding pages using a strict Test-Driven Development (TDD) workflow.
- **Mechanism:**
  1.  **Data Layer First:** Begin by modifying the backend `User` schema to add the `nightscoutTokenLast3` field.
  2.  **Secure API Logic:** Update the `PUT /api/user/settings` endpoint to apply rate limiting and correctly populate the new token hint field.
  3.  **Session Refactor:** Update the backend `session` callback to read the new hint field directly, removing the insecure decryption step.
  4.  **Abstract Logic:** Create the reusable `useApiForm` hook and its corresponding test.
  5.  **Agreements Page:** Use TDD to build the `AgreementsPage`, leveraging the new `useApiForm` hook.
  6.  **Setup Page:** Use TDD to build the `SetupPage`, ensuring tests cover all scenarios and leveraging the `useApiForm` hook.
- **Trade-offs:** This security-first approach has a slightly higher initial setup cost but ensures the core data model and API are robust before building UI that depends on them. This minimizes rework and enforces a secure-by-default architecture.
- **Go/No-Go Decision:** **Go**. This task is a critical blocker for the entire authenticated user experience.

## Implementation Notes

- **API Endpoint:** All data will be sent to `PUT /api/user/settings`.
- **API Client:** Use the pre-configured `api` object from `frontend/src/lib/api.ts`.
- **Navigation:** Use the `useNavigate` hook from `react-router-dom` for programmatic redirection.
- **`useApiForm` Hook:** This new hook will accept a submission function and return a handler, a boolean `isSubmitting` state, and an `error` string. `const [handleSubmit, isSubmitting, error] = useApiForm(async (data) => { /* api call */ });`
- **Payloads:**
  - Agreements Page: `{ agreementsSigned: true }`
  - Setup Page: `{ nightscoutUrl: string | null, nightscoutToken: string | null, preferredUnits: "MGDL" | "MMOL" }`. Empty string inputs for `nightscoutUrl` and `nightscoutToken` **must** be converted to `null` before sending. If `nightscoutToken` is `null`, the backend will know not to update the existing token.
- **Partial Token Display:** The `SetupPage` must display a sub-label for the token field: "Token set to \*[last 3 characters]. Leave blank to keep your existing token."

## Acceptance Gates

1.  The submit button on `AgreementsPage` is disabled until both agreement checkboxes are checked.
2.  Submitting the `AgreementsPage` successfully redirects the user to `/setup`.
3.  When a user with existing settings navigates to `/setup`, the form fields for URL and units are pre-filled with their current data.
4.  The `nightscoutToken` field on the `SetupPage` is always blank, but displays a sub-label with the last 3 characters of the token if one is set.
5.  Submitting the `SetupPage` form successfully redirects the user to `/dashboard`.
6.  All new and modified test files pass when running `npm test -w frontend`.
7.  The `PUT /api/user/settings` endpoint is rate-limited.

## “Make-sure-you” Checklist

- [ ] Have you added the `nightscoutTokenLast3` field to the `schema.prisma` file and run a migration?
- [ ] Have you updated the `PUT /api/user/settings` logic to populate this new field and added rate limiting?
- [ ] Have you updated the `session` callback in `backend/src/lib/auth.ts` to remove the decryption call?
- [ ] Have you created and used the new `useApiForm` hook in both pages?
- [ ] Does the `SetupPage` correctly convert empty string inputs for Nightscout fields into `null`?

## Project hygiene prep

1.  **Create Issue:**
    ```bash
    gh issue create --title "feat(ui): P5_T5.3 Implement Onboarding Pages" --body "Build and test the Agreements and Account Setup pages to complete the user onboarding flow, including edit functionality. Closes #XX"
    ```
2.  **Create Branch:**
    ````bash
    git checkout phase5develop
    git pull origin phase5develop
    git checkout -b feat/phase5-task5.3-onboarding-ui
    ```3.  **TDD Workflow:** Follow the Red-Green-Refactor cycle for each step below. Run `npm test -w frontend` frequently.
    ````

---

## In-depth engineering plan

### Part 0: Backend Security Enhancements

#### Step 1 (GREEN): Update Database Schema

Add the new `nightscoutTokenLast3` field to the `User` model. This is the foundation for our more secure token-handling strategy.

```diff
--- a/backend/prisma/schema.prisma
+++ b/backend/prisma/schema.prisma
@@ -31,6 +31,7 @@
   // Application-specific settings
   nightscoutUrl   String?
   nightscoutToken String?
+  nightscoutTokenLast3 String?
   preferredUnits  GlucoseUnit @default(MGDL)
   rssToken        String    @unique @default(cuid())
 }

```

After saving the schema, create and apply the database migration.

````bash
npx prisma migrate dev --name feat-add-token-hint```

#### Step 2 (GREEN): Harden the User Settings API

Update `backend/src/routes/user.ts` to implement rate limiting and the logic to securely store the token hint.

```diff
--- a/backend/src/routes/user.ts
+++ b/backend/src/routes/user.ts
@@ -4,8 +4,19 @@
 import { userSettingsSchema } from '@goodnumbers/schemas';
 import { encrypt } from '../lib/encryption.js';
 import { z } from 'zod';
+import rateLimit from 'express-rate-limit';
+
+// Create a specific rate limiter for this sensitive endpoint.
+const settingsLimiter = rateLimit({
+  windowMs: 15 * 60 * 1000, // 15 minutes
+  max: 20, // Limit each IP to 20 requests per window
+  message: { error: 'Too many requests to update settings, please try again after 15 minutes.' },
+});

 const router = Router();

-router.put('/settings', protect, enforceAgreements, async (req, res) => {
+router.put('/settings', protect, enforceAgreements, settingsLimiter, async (req, res) => {
   const userId = req.user?.id;
   if (!userId) {
     return res.status(401).json({ error: 'Not authenticated' });
@@ -19,13 +30,18 @@
       ...validatedSettings,
     };

-    // CRITICAL: Only encrypt the token if it's a non-null string.
+    // Securely handle the Nightscout token
     if (typeof validatedSettings.nightscoutToken === 'string') {
-      dataToUpdate.nightscoutToken = encrypt(validatedSettings.nightscoutToken);
+      const token = validatedSettings.nightscoutToken;
+      // 1. Store the encrypted full token
+      dataToUpdate.nightscoutToken = encrypt(token);
+      // 2. Store the non-sensitive 3-char hint
+      dataToUpdate.nightscoutTokenLast3 = token.slice(-3);
     } else if (validatedSettings.nightscoutToken === null) {
-      // If the user submitted a blank token, we do not update it.
-      // However, we should not clear the hint.
-      dataToUpdate.nightscoutToken = null;
+      // If the user submitted a blank token field, it gets converted to null.
+      // In this case, we delete the key to prevent overwriting the existing token.
+      // This ensures a user can update their units without needing to re-enter their token.
+      delete dataToUpdate.nightscoutToken;
     }

     await prisma.user.update({

````

### Part 1: Foundational Refactoring

#### Step 3 (GREEN): Update Backend Session Logic

Modify the `session` callback in `backend/src/lib/auth.ts`. This is now much simpler and more secure, as it only reads the pre-calculated hint and performs no decryption.

```diff
--- a/backend/src/lib/auth.ts
+++ b/backend/src/lib/auth.ts
@@ -88,12 +88,11 @@
     // This callback runs on the server and enriches the session object
     // to make user data available to our middleware without extra DB calls.
     async session({ session, user }) {
       if (session.user) {
         session.user.id = user.id;
         session.user.agreementsSigned = user.agreementsSigned;
-        session.user.nightscoutUrl = user.nightscoutUrl;
         session.user.preferredUnits = user.preferredUnits;
+        // NEW: Add the required fields for the setup/settings page
+        session.user.nightscoutUrl = user.nightscoutUrl;
+        // SECURE: Read the pre-calculated, non-sensitive hint directly.
+        session.user.nightscoutTokenLast3 = user.nightscoutTokenLast3;
       }
       return session;
     },
@@ -108,6 +107,7 @@
   interface User {
     agreementsSigned?: boolean;
     nightscoutUrl?: string | null;
+    nightscoutTokenLast3?: string | null;
     preferredUnits?: string;
   }
 }

```

#### Step 4 (GREEN): Update Frontend Types

Update the `SessionUser` interface in `frontend/src/contexts/AuthTypes.ts` to match the new data from the backend.

```diff
--- a/frontend/src/contexts/AuthTypes.ts
+++ b/frontend/src/contexts/AuthTypes.ts
@@ -3,4 +3,7 @@
   id: string;
   name?: string | null;
   email?: string | null;
+  agreementsSigned?: boolean;
+  nightscoutUrl?: string | null;
+  preferredUnits?: 'MGDL' | 'MMOL';
+  nightscoutTokenLast3?: string | null;
 }
```

### Part 2: Abstract Reusable Form Logic

#### Step 5 (RED): Test the `useApiForm` Hook

Create `frontend/src/hooks/useApiForm.test.tsx`. This test will define the behavior of our reusable hook.

```typescript
// file: frontend/src/hooks/useApiForm.test.tsx
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useApiForm } from "./useApiForm";

describe("useApiForm", () => {
  it("should handle successful submission", async () => {
    const mockSubmitter = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useApiForm(mockSubmitter));

    const [handleSubmit] = result.current;

    await act(async () => {
      await handleSubmit({ test: "data" });
    });

    const [, isSubmitting, error] = result.current;
    expect(mockSubmitter).toHaveBeenCalledWith({ test: "data" });
    expect(isSubmitting).toBe(false);
    expect(error).toBeNull();
  });

  it("should handle submission failure", async () => {
    const error = new Error("API Error");
    const mockSubmitter = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useApiForm(mockSubmitter));

    const [handleSubmit] = result.current;

    await act(async () => {
      await handleSubmit({});
    });

    const [, isSubmitting, finalError] = result.current;
    expect(isSubmitting).toBe(false);
    expect(finalError).toBe("API Error");
  });
});
```

#### Step 6 (GREEN): Implement the `useApiForm` Hook

Create `frontend/src/hooks/useApiForm.tsx` to make the tests pass.

```typescript
// file: frontend/src/hooks/useApiForm.tsx
import { useState } from "react";

type Submitter<T> = (data: T) => Promise<unknown>;
type HandleSubmit<T> = (data: T) => Promise<void>;

export function useApiForm<T>(
  submitter: Submitter<T>,
): [HandleSubmit<T>, boolean, string | null] {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: T) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitter(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return [handleSubmit, isSubmitting, error];
}
```

### Part 3: Implement the Agreements Page

#### Step 7 (RED): Test the V3 Agreements Page

Create `frontend/src/pages/AgreementsPage.test.tsx` to validate all aspects of the V3 design, including copy, checkbox logic, and form submission states.

```typescript
// file: frontend/src/pages/AgreementsPage.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AgreementsPage from './AgreementsPage';

// Mock the reusable form hook and the navigation hook
const mockUseApiForm = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../hooks/useApiForm', () => ({
  useApiForm: mockUseApiForm,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AgreementsPage', () => {
  beforeEach(() => {
    // Before each test, reset mocks to a default "non-submitting" state
    mockUseApiForm.mockReturnValue([vi.fn(), false, null]);
    mockNavigate.mockClear();
  });

  it('renders all required text, checkboxes, and a disabled button', () => {
    render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

    // Check for V3 spec content
    expect(screen.getByRole('heading', { name: /Welcome to GoodNumbers/i })).toBeInTheDocument();
    expect(screen.getByText(/Before we can create your account/i)).toBeInTheDocument();

    // Check for both checkbox labels
    const termsCheckbox = screen.getByLabelText(/i accept the terms and conditions/i);
    const privacyCheckbox = screen.getByLabelText(/i have read and accept the privacy policy/i);
    expect(termsCheckbox).toBeInTheDocument();
    expect(privacyCheckbox).toBeInTheDocument();
    expect(termsCheckbox).not.toBeChecked();
    expect(privacyCheckbox).not.toBeChecked();

    // Check for the button and its initial disabled state
    const continueButton = screen.getByRole('button', { name: /Accept and Continue to Setup/i });
    expect(continueButton).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
  });

  it('enables the continue button only when both checkboxes are checked', () => {
    render(<MemoryRouter><AgreementsPage /></MemoryRouter>);
    const termsCheckbox = screen.getByLabelText(/i accept the terms and conditions/i);
    const privacyCheckbox = screen.getByLabelText(/i have read and accept the privacy policy/i);
    const continueButton = screen.getByRole('button', { name: /Accept and Continue to Setup/i });

    // Check one, button should still be disabled
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(privacyCheckbox).not.toBeChecked();
    expect(continueButton).toBeDisabled();

    // Check the other, button should now be enabled
    fireEvent.click(privacyCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(privacyCheckbox).toBeChecked();
    expect(continueButton).toBeEnabled();

    // Uncheck one, button should become disabled again
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).not.toBeChecked();
    expect(continueButton).toBeDisabled();
  });

  it('calls the api submission hook with correct data when submitted', () => {
    const mockHandleSubmit = vi.fn();
    mockUseApiForm.mockReturnValue([mockHandleSubmit, false, null]);

    render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

    // Enable the button
    fireEvent.click(screen.getByLabelText(/i accept the terms and conditions/i));
    fireEvent.click(screen.getByLabelText(/i have read and accept the privacy policy/i));

    // Click the button and verify the submission handler was called
    fireEvent.click(screen.getByRole('button', { name: /Accept and Continue to Setup/i }));
    expect(mockHandleSubmit).toHaveBeenCalledWith({ agreementsSigned: true });
  });
});
```

#### Step 8 (GREEN): Implement V3 Agreements Page

Create the `frontend/src/pages/AgreementsPage.tsx` file, using Tailwind CSS to match the V3 design and leveraging the `useApiForm` hook.

```typescript
// file: frontend/src/pages/AgreementsPage.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApiForm } from '../hooks/useApiForm';

export default function AgreementsPage() {
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const navigate = useNavigate();

  // This boolean determines if the form is valid and the button should be enabled.
  const canContinue = termsAgreed && privacyAgreed;

  // Use our custom hook to manage the form's submission state.
  // On success, it automatically navigates to the next step in the onboarding flow.
  const [handleApiSubmit, isSubmitting, error] = useApiForm(async (data: { agreementsSigned: boolean }) => {
    await api.put('/user/settings', data);
    navigate('/setup');
  });

  // This function handles the form's onSubmit event.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue) {
      // We call the handler from our hook, passing the required payload.
      void handleApiSubmit({ agreementsSigned: true });
    }
  };

  return (
    <div className="bg-light pt-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 text-center">Welcome to GoodNumbers</h1>
          <p className="mt-2 text-center text-gray-600">Before we can create your account, you must review and accept the agreements below.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor="terms" className="text-gray-700 text-base">
                  I accept the <Link to="/terms" className="font-medium v3-primary-text hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Terms and Conditions</Link>. I understand that <strong className="font-bold">GoodNumbers is an experimental project, is NOT medical advice</strong>, and may provide incorrect or misleading information. I confirm that I will <strong className="font-bold">always consult a healthcare professional</strong> before making any changes to my diabetic healthcare plan, insulin usage, or device settings. I accept all responsibility and liability for the use of this software.
                </label>
              </div>
            </div>

            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="privacy"
                  name="privacy"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor="privacy" className="text-gray-700 text-base">
                  I have read and accept the <Link to="/privacy" className="font-medium v3-primary-text hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Privacy Policy</Link>. I consent to the storage and processing of my pseudonymized health data (including any treatment, CGM data, Nightscout data, etc) for the purpose of journal analysis and feature development. I understand I am responsible for the data I share.
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm font-medium text-critical-red">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={!canContinue || isSubmitting}
                className="flex w-full justify-center rounded-lg px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors duration-150 disabled:bg-gray-400 disabled:text-gray-700 enabled:v3-bg-primary enabled:v3-hover-bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {isSubmitting ? 'Saving and Continuing...' : 'Accept and Continue to Setup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### Part 4: Implement the Account Setup Page

#### Step 9 (RED): Test the Setup Page

**This is a new step to address the missing test file.** Create `frontend/src/pages/SetupPage.test.tsx` with comprehensive tests covering all functional requirements.

```typescript
// file: frontend/src/pages/SetupPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SetupPage from './SetupPage';
import * as useAuthModule from '../hooks/useAuth';
import { useApiForm, type Submitter, type HandleSubmit } from '../hooks/useApiForm';
import { type SessionUser } from '../contexts/AuthTypes';

// Mock the hooks used by the component
vi.mock('../hooks/useAuth');
vi.mock('../hooks/useApiForm');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedUseApiForm = useApiForm as Mock;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SetupPage', () => {
  const mockHandleSubmit = vi.fn();

  beforeEach(() => {
    mockedUseAuth.mockClear();
    mockedUseApiForm.mockClear();
    mockNavigate.mockClear();
    mockHandleSubmit.mockClear();

    // Default mock for useApiForm
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, false, null]);
  });

  it('renders the form correctly for a new user', () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, error: null });
    render(<MemoryRouter><SetupPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: /Account Setup/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nightscout URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nightscout Token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred Units/i)).toBeInTheDocument();
    expect(screen.queryByText(/Token is set/i)).not.toBeInTheDocument();
  });

  it('pre-fills form data for an existing user but keeps token field blank', () => {
    const mockUser: SessionUser = {
      id: '1',
      nightscoutUrl: 'https://my-test-site.com',
      preferredUnits: 'MMOL',
      nightscoutTokenLast3: 'xyz',
    };
    mockedUseAuth.mockReturnValue({ user: mockUser, isLoading: false, error: null });

    render(<MemoryRouter><SetupPage /></MemoryRouter>);

    expect(screen.getByLabelText(/Nightscout URL/i)).toHaveValue(mockUser.nightscoutUrl!);
    expect(screen.getByLabelText(/Preferred Units/i)).toHaveValue(mockUser.preferredUnits!);
    expect(screen.getByLabelText(/Nightscout Token/i)).toHaveValue(''); // Security: Token field should always be empty
  });

  it('displays the token hint when a token is already set', () => {
    const mockUser: SessionUser = { id: '1', nightscoutTokenLast3: 'xyz' };
    mockedUseAuth.mockReturnValue({ user: mockUser, isLoading: false, error: null });

    render(<MemoryRouter><SetupPage /></MemoryRouter>);
    expect(screen.getByText(/Token is set, ending in \.\.\.xyz/i)).toBeInTheDocument();
  });

  it('converts empty string inputs to null on submission', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: '1' } as SessionUser, isLoading: false, error: null });
    render(<MemoryRouter><SetupPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/Nightscout URL/i), { target: { value: ' ' } }); // Whitespace
    fireEvent.change(screen.getByLabelText(/Nightscout Token/i), { target: { value: '' } }); // Empty

    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(mockHandleSubmit).toHaveBeenCalledWith({
        nightscoutUrl: null,
        nightscoutToken: null, // Ensure empty string becomes null
        preferredUnits: 'MGDL', // Default value
      });
    });
  });

  it('displays loading state and disables button during submission', () => {
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, true, null]); // isSubmitting = true
    render(<MemoryRouter><SetupPage /></MemoryRouter>);

    const button = screen.getByRole('button', { name: /Saving\.\.\./i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('displays an error message on submission failure', () => {
    const errorMessage = 'Failed to save';
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, false, errorMessage]);
    render(<MemoryRouter><SetupPage /></MemoryRouter>);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
```

#### Step 10 (GREEN): Implement the Setup Page with Hook

Refactor `frontend/src/pages/SetupPage.tsx` to use the `useApiForm` hook and satisfy the new tests.

```diff
--- a/frontend/src/pages/SetupPage.tsx
+++ b/frontend/src/pages/SetupPage.tsx
-import { useState, type FormEvent, useEffect } from 'react';
+import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { api } from '../lib/api';
 import { useAuth } from '../hooks/useAuth';
+import { useApiForm } from '../hooks/useApiForm';

 export default function SetupPage() {
   const { user } = useAuth();
   const navigate = useNavigate();

-  const [nightscoutUrl, setNightscoutUrl] = useState('');
-  const [nightscoutToken, setNightscoutToken] = useState('');
+  // Form state remains local
+  const [url, setUrl] = useState('');
+  const [token, setToken] = useState('');
   const [preferredUnits, setPreferredUnits] = useState<'MGDL' | 'MMOL'>('MGDL');
-  const [isSubmitting, setIsSubmitting] = useState(false);
-  const [error, setError] = useState<string | null>(null);

   useEffect(() => {
     if (user) {
-      setNightscoutUrl(user.nightscoutUrl ?? '');
+      setUrl(user.nightscoutUrl ?? '');
       setPreferredUnits(user.preferredUnits ?? 'MGDL');
     }
   }, [user]);

-  const handleSubmit = async (e: FormEvent) => {
-    e.preventDefault();
-    setIsSubmitting(true);
-    setError(null);
-
-    try {
-      const payload = {
-        nightscoutUrl: nightscoutUrl.trim() === '' ? null : nightscoutUrl,
-        nightscoutToken: nightscoutToken.trim() === '' ? null : nightscoutToken,
-        preferredUnits,
-      };
-      await api.put('/user/settings', payload);
-      navigate('/dashboard');
-    } catch (err) {
-      setError('Failed to save settings. Please try again.');
-    } finally {
-      setIsSubmitting(false);
-    }
-  };
+  const [handleApiSubmit, isSubmitting, error] = useApiForm(async () => {
+    const payload = {
+      nightscoutUrl: url.trim() === '' ? null : url.trim(),
+      nightscoutToken: token.trim() === '' ? null : token.trim(),
+      preferredUnits,
+    };
+    await api.put('/user/settings', payload);
+    navigate('/dashboard');
+  });

   return (
     <div className="max-w-2xl mx-auto py-16 px-4">
       <h1 className="text-3xl font-bold text-center">Account Setup</h1>
       <p className="text-center text-gray-600 mt-2">Connect your Nightscout instance to get started.</p>
       <div className="mt-8 p-8 border rounded-lg bg-white shadow-sm">
-        <form onSubmit={handleSubmit}>
+        <form onSubmit={(e) => { e.preventDefault(); void handleApiSubmit(); }}>
           <div className="space-y-6">
             <div>
               <label htmlFor="nightscoutUrl" className="block text-sm font-medium text-gray-700">
@@ -74,8 +66,8 @@
                 type="text"
                 id="nightscoutUrl"
                 name="nightscoutUrl"
-                value={nightscoutUrl}
-                onChange={(e) => setNightscoutUrl(e.target.value)}
+                value={url}
+                onChange={(e) => setUrl(e.target.value)}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                 placeholder="https://your-nightscout-site.com"
               />
@@ -87,8 +79,8 @@
                 type="password"
                 id="nightscoutToken"
                 name="nightscoutToken"
-                value={nightscoutToken}
-                onChange={(e) => setNightscoutToken(e.target.value)}
+                value={token}
+                onChange={(e) => setToken(e.target.value)}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
               />
               {user?.nightscoutTokenLast3 && (

```

### Part 5: Final Configuration Fix

#### Step 11 (GREEN): Fix the `lint-staged` Pre-Commit Hook

Update the `lint-staged` configuration in the root `package.json` to correctly run linting across all workspaces before a commit.

**File to Modify:** `package.json` (at the project root)

**Change to Make:**

````diff
--- a/package.json
+++ b/package.json
@@ -25,8 +25,8 @@
   },
   "lint-staged": {
     "*.{ts,tsx,js,jsx}": [
-      "eslint --fix --config goodnumbers/eslint.config.js",
+      "npm run lint -- --fix",
       "prettier --write"
     ]
   }
 }```
````
