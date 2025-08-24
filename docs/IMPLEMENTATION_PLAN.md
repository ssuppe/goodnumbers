# Goodnumbers Implementation Plan

**Version:** 1.3
**Date:** 2025-08-14

## 1. Overview

This document outlines the phased, step-by-step implementation plan for the Goodnumbers project. The plan follows a measured, test-driven approach, ensuring that each component is built and verified before moving to the next. Each task should be developed on a dedicated feature branch and merged into the `develop` branch via a Pull Request, as defined in `DEVELOPMENT_PROCESS.md`.

## 2. Testing Strategy

To support the MVP goals of stability and quality without undue complexity, this project will adopt a pragmatic, multi-layered testing strategy that introduces tools and techniques incrementally as features are developed.

### 2.1. Philosophy

- **Pragmatic for MVP:** The focus is on creating a robust safety net for core logic and preventing regressions, not achieving 100% test coverage.
- **Incremental Complexity:** Testing tools and patterns will be introduced in the phase where they are first needed, avoiding upfront overhead.

### 2.2. Levels of Testing & Tooling

... (existing content) ...

#### 2.2.1. A Two-Tier Approach to Integration Testing

For services that interact with external dependencies like a database or a Redis queue, we will adopt a two-tier integration testing strategy to balance speed and confidence:

1.  **Tier 1: Mocked Integration Tests (Fast Feedback)**

    - **Purpose:** To verify the application's internal logic and the "contract" between different parts of our code. For example, ensuring an API route correctly calls a specific function from our queue library.
    - **Mechanism:** We use Jest's mocking capabilities (`jest.unstable_mockModule`) to replace the real external dependency with a controlled, in-memory version.
    - **Characteristics:** These tests are extremely fast, reliable, and can run in parallel without interfering with each other. They are ideal for running frequently during local development.
    - **Example:** `tests/integration/queue.test.ts`

2.  **Tier 2: "True" Integration Tests (High Confidence)**
    - **Purpose:** To verify the application's ability to correctly connect to, serialize data for, and interact with a real backing service (e.g., the Redis server running in Docker).
    - **Mechanism:** These tests run against a live service. They use environment variables to configure the application to use a unique, isolated namespace (like a specific queue name) for the duration of the test run.
    - **Characteristics:** These tests are slower and require the external dependency to be running. They provide the highest level of confidence that the entire integrated system works as expected. They are critical for our CI/CD pipeline before a deployment.
    - **Example:** `tests/integration/real-queue.test.ts`

... (rest of the document) ...

1.  **Unit Testing:**

    - **Goal:** To test the smallest pieces of logic (e.g., a single utility function) in complete isolation.
    - **Tool:** **Jest** will be used for its test runner, assertion library (`expect`), and mocking capabilities.

2.  **Integration Testing:**

    - **Goal:** To test how multiple units work together.
    - **Backend Tools:** **Jest** and **`supertest`** will be used to test Express API endpoints, ensuring the HTTP layer, middleware, and service logic function correctly as a group.
    - **Frontend Tools:** **Jest** and **React Testing Library** will be used to test React components, ensuring they render and behave correctly from a user's perspective.

3.  **End-to-End (E2E) Testing:**
    - **Goal:** To test critical user journeys from start to finish in a real browser environment.
    - **Tool:** **Playwright** will be used to automate browser actions and validate complete workflows (e.g., login -> create journal -> view result). This will be introduced in Phase 5.

### 2.3. Testing Conventions

- **Directory Structure:** All test files will reside in a top-level `tests/` directory within the `goodnumbers` project folder. This directory will be further organized into `unit/` and `integration/` subdirectories.
- When running npm for the new goodnumbers project, always always always append "cd goodnumbers &&" first so it runs in the right folder.
- **File Naming:** Test files should be named to correspond with the module they are testing (e.g., `database.test.ts`, `encryption.test.ts`).
- **Database Files:** Local development database files (e.g., `goodnumbers/prisma/dev.db`) are ephemeral and must be added to the `.gitignore` file. The schema is managed solely through version-controlled migration files.

### 2.4. Mocking with ES Modules

When using ES Modules (`"type": "module"` in `package.json`), the standard `jest.mock()` function can be unreliable for mocking modules, especially built-in Node.js modules like `fs/promises`. This is due to the way ES Modules are loaded and how Jest's hoisting mechanism works.

**Recommended Approach:**

To reliably mock modules in an ES Module environment, use the experimental `jest.unstable_mockModule()` API combined with dynamic `import()`.

**Example (`auth.test.ts`):**

```typescript
import { jest, describe, it, expect } from "@jest/globals";

// Mock fs/promises *before* importing the auth module
jest.unstable_mockModule("fs/promises", () => ({
  readFile: jest.fn(),
}));

// Dynamically import the modules
const { readFile } = await import("fs/promises");
const { authConfig } = await import("../../src/lib/auth"); // Assuming authConfig is the main export

describe("signIn callback", () => {
  it("should allow a user on the allowlist", async () => {
    // Configure the mock for this test
    (readFile as jest.Mock).mockResolvedValue("user@example.comn");

    // ... rest of the test
  });
});
```

This approach ensures that the mock is registered before your code imports the module, providing a reliable way to isolate dependencies in your tests.

## 3. Task-Level Workflow

For each task listed in the implementation phases below, the following GitHub-integrated workflow must be followed:

1.  **Create an Issue:** Before beginning work, create a GitHub Issue to track the task. This can be done via the `gh` command-line tool. The issue will serve as a central place for discussion and to document specific implementation details.

    ```bash
    # Example for Phase 2, Task 1
    gh issue create --title "feat(auth): Implement Auth.js with Email Allowlist" --body "Integrate Auth.js with Google SSO and an email allowlist as per docs/eng/PHASE2_TASK1.md. This replaces the old password barrier."
    ```

2.  **Create a Branch:** Create a feature branch from the `develop` branch. It is recommended to include the issue number in the branch name for easy tracking.

    ```bash
    # Example assuming the issue created is #23
    git checkout -b feat/23-authjs-allowlist
    ```

3.  **Implement and Test:** Adhere to a "test-first" approach. The general workflow for a task should be:
    a. **Red:** Write a failing test that defines the desired functionality.
    b. **Green:** Write the simplest implementation code to make the test pass.
    c. **Refactor:** Clean up the implementation, ensuring the test still passes.

    Make small, atomic commits using the Conventional Commit standard.

4.  **Open a Pull Request:** Once the task is complete and all local tests are passing, open a Pull Request against the `develop` branch. The PR description should link to the issue it resolves using a keyword like `Closes #23`.

    ```bash
    gh pr create --base develop --title "feat(auth): P2_T1 Implement Auth.js with Email Allowlist" --body "Closes #23. This PR integrates Auth.js and replaces the site barrier with an email allowlist."
    ```

5.  **Review and Merge:** Follow the PR review and merge process defined in `DEVELOPMENT_PROCESS.md`. The merge will automatically close the associated issue.

---

## 4. Implementation Phases

**Note:** All tasks outlined below are expected to be developed following the "Red-Green-Refactor" cycle as described in the "Implement and Test" step of the Task-Level Workflow.

### **Phase 0: Project Restructuring** - COMPLETE

**Goal:** Archive the existing proof-of-concept code to prepare for a clean, new implementation from the project root, while preserving the old code for reference.

1.  **Task: Archive Existing Proof of Concept**
    - **Action:** Create a new directory at the project root named `proof_of_concept`.
    - **Action:** Move all contents of the existing `goodnumbers/` directory into the new `proof_of_concept/` directory.
    - **Test:** Manually verify that the file move is complete and the `goodnumbers/` directory is gone.
    - **Commit:** `chore: Archive existing proof-of-concept code`

### **Phase 1: Project Setup & Core Backend Foundation** - COMPLETE

**Goal:** Establish a runnable server, a database schema, and core utilities. This phase ensures the absolute fundamentals are working before any feature logic is added.

1.  **Task: Initialize Project & Dependencies** - COMPLETE

    - Make a new subfolder calld 'goodnumbers' which will be the project root
    - **Action:** Set up the Node.js project (`npm init`), install core dependencies (Express, Prisma, TypeScript), and configure project files (`tsconfig.json`, `.pylintrc`, `.prettierrc`).
    - **Action:** Install testing dependencies: `jest`, `ts-jest`, `@types/jest`, `supertest`.
    - **Test:** Confirm the project compiles (`tsc`), lints, and the test runner executes without errors.
    - **Commit:** `chore: Initial project setup and configuration`

2.  **Task: Implement Database Schema** - COMPLETE

    - **Action:** Create the `goodnumbers/prisma/schema.prisma` file and populate it with the models from the technical specification.
    - **Action:** Add `*.db` to the `goodnumbers/prisma/.gitignore` file to ensure local database files are not committed.
    - **Test (Red):** Create a new integration test file at `goodnumbers/tests/integration/database.test.ts`. Write a test that attempts to connect to the database via the Prisma client and query the user table. This test will fail initially.
    - **Action (Green):** Run `npx prisma migrate dev --name init` in the `goodnumbers` directory. This will create the migration, set up the database, and generate the Prisma client, allowing the test to pass.
    - **Refactor:** Review the schema and test for correctness and clarity.
    - **Commit:** `feat(db): implement initial prisma schema`

3.  **Task: Create Basic Express Server** - COMPLETE

    - **Action:** Set up a minimal Express server application that listens on a port.
    - **Action:** Add `helmet` and `express-rate-limit` middleware to set secure HTTP headers and provide basic DoS protection.
    - **Action:** Create a public `/health` endpoint that returns a `200 OK` with a JSON body like `{"status": "ok"}`.
    - **Action:** Install `zod` and establish a pattern for API input validation, to be used by all endpoints that accept data.
    - **Action:** Implement a global, catch-all error-handling middleware that logs errors server-side and returns a generic 500 error message to the client in production.
    - **Test:** In a new file at `goodnumbers/tests/integration/server.test.ts`, write a test using Jest and `supertest` that makes a request to the `/health` endpoint and asserts the response is correct.
    - **Commit:** `feat(server): add basic express server with health check and security hardening`

4.  **Task: Build Credential Encryption Utility** - COMPLETE
    - **Action:** Create a self-contained utility module (`encryption.ts`) with `encrypt` and `decrypt` functions using Node.js's built-in `crypto` module, as specified for handling Nightscout credentials.
    - **Action:** Install and configure `dotenv` to load the `ENCRYPTION_KEY` from a `.env` file in the application's entry point.
    - **Test:** Write unit tests using Jest for the encryption utility. Ensure that `decrypt(encrypt(data))` returns the original data. Test edge cases like empty or null inputs and initialization failures.
    - **Commit:** `feat(utils): create encryption utility for sensitive data`

### **Phase 2: Authentication & User Management**

**Goal:** The goal of this phase is to implement all functionality related to user identity, from initial access control to managing user-specific settings.

1.  **Task: Implement User Authentication with Email Allowlist**

    - **Goal:** Integrate Auth.js using the `@auth/express` package with the Google Provider. Crucially, we will replace the old concept of a site-wide password barrier with a more secure email-based allowlist. This ensures only pre-approved beta testers can sign in. This task merges and replaces the previous "barrier" and "Auth.js integration" tasks.
    - **Reference:** This implementation should precisely follow the detailed guide in `docs/eng/SSO_ALLOWLIST_PROPOSAL.md`.
    - **Action (Cleanup):** Begin by completely removing the old barrier implementation. Delete the following files if they exist:
      - `goodnumbers/src/middleware/barrier.ts`
      - `goodnumbers/src/routes/barrier.ts`
      - `goodnumbers/public/barrier-login.html`
    - **Action (Cleanup):** In `goodnumbers/src/index.ts`, remove all imports and `app.use()` calls related to `cookie-session`, `barrierMiddleware`, and `barrierRouter`.
    - **Action (Configuration):** Create a new configuration file at `goodnumbers/config/allowed_emails.txt`. Add your own Google email address to this file for testing purposes.
    - **Test (Red - Manual Verification):** At this point, no access control exists. The next step is to add Auth.js.
    - **Action (Green - Implementation):** Modify `goodnumbers/src/lib/auth.ts`. Implement the `signIn` callback as described in the proposal. This callback will:
      1.  Read the emails from `config/allowed_emails.txt`.
      2.  Check if the email of the user attempting to sign in is present in the list.
      3.  Return `true` if the email is on the list (allowing sign-in) or `false` if it is not (denying sign-in).
      4.  Implement caching to avoid reading the file on every single login attempt.
      5.  Implement robust error handling: if the file cannot be read, it must default to denying all access for security.
    - **Test (Green - Manual Verification):**
      1.  **Positive Test:** Run the application and attempt to sign in with the Google account you added to the allowlist. Verify you are granted access. Check server logs for the "ALLOWED" message.
      2.  **Negative Test:** Use a different Google account that is **not** on the list. Verify you are denied access and redirected. Check server logs for the "DENIED" message.
      3.  **Error Test:** Temporarily rename the allowlist file and restart the server. Attempt to log in with any account. Verify you are denied access and see the "CRITICAL ERROR" in the logs. This confirms our secure-by-default posture.
    - **Commit:** `feat(auth): P2_T1 implement Auth.js with email allowlist`

2.  **Task: Implement Agreement Gate Logic**

    - **Action:** Add the `agreementsSigned` boolean field to the `User` model in `prisma/schema.prisma`. Run a new database migration.
    - **Action:** Modify the `Auth.js signIn` callback in `goodnumbers/src/lib/auth.ts` to automatically set the `agreementsSigned` flag to `true` for any user who successfully authenticates. This is an idempotent solution that supports the frontend-driven agreement process.
    - **Test:** Write an integration test in `goodnumbers/tests/integration/auth.test.ts` that verifies the `signIn` callback correctly sets `agreementsSigned` to `true` for an authenticated user.
    - **Deviation from Plan:** The original plan included creating a `POST /api/user/sign-agreements` endpoint and a global middleware for redirection. This was simplified to directly update the `agreementsSigned` flag in the `signIn` callback for idempotency and robustness, removing the need for a separate API endpoint and redirect middleware.
    - **Manual Verification Note:** Manual verification of this specific logic proved challenging due to complexities with Google OAuth and `ts-node` module resolution in the testing environment. Therefore, we are relying on the comprehensive automated test in `auth.test.ts` as sufficient verification for this task.
    - **Commit:** `feat(auth): P2_T2 implement agreement-on-signin logic`

3.  **Task: Implement User Settings API**

    - **Action:** Create the `PUT /api/user/settings` endpoint. This endpoint will handle updates to `preferredUnits` and will use the encryption utility to securely save the `nightscoutUrl` and `nightscoutToken`. The request body must be validated using `zod`.
    - **Test:** Write an integration test using Jest and `supertest` that mocks an authenticated user, calls the endpoint with new settings, and then queries the database directly to verify the data was saved correctly (and that credentials are encrypted).
    - **Commit:** `feat(api): P2_T3 implement endpoint for user settings`

4.  **Task: Implement RSS Token Regeneration**
    - **Action:** Create the `POST /api/user/regenerate-rss-token` endpoint.
    - **Test:** Write an integration test using Jest and `supertest` that gets a user's original token, calls the endpoint, and asserts that the token stored in the database has changed.
    - **Commit:** `feat(api): P2_T4 add endpoint for rss token regeneration`

### **Phase 3: Core Journal Feature (Backend API)**

**Goal:** Build out all the backend API endpoints related to the journal lifecycle. At the end of this phase, the backend will be ready, but the actual data processing will not be implemented yet.

1.  **Task: Implement Journal CRUD APIs**

    - **Action:** Implement the foundational journal endpoints: `POST`, `GET` (list), `GET` (by ID), `PUT`, and `DELETE` for `/api/journals`. All endpoints accepting data must use `zod` for validation.
    - **Test:** Write integration tests using Jest and `supertest` for each endpoint. Crucially, ensure that ownership is enforced (a user cannot access or modify another user's journals).
    - **Commit:** `feat(api): P3_T1 implement crud api for journals`

2.  **Task: Set Up Background Job Queue**

    - **Action:** Integrate BullMQ and configure its connection to a Redis instance.
    - **Action:** Modify the `POST /api/journals` endpoint to enqueue a new job with the `journalId` upon successful creation.
    - **Action:** Create a skeleton background worker that listens to the queue and logs the ID of any received job.
    - **Test:** Write an integration test that calls the journal creation API and then checks the queue (via a Redis client) to confirm a job was successfully enqueued.
    - **Commit:** `feat(worker): P3_T2 integrate bullmq for background job processing`

3.  **Task: Implement Journal Status API**
    - **Action:** Create the `GET /api/journal-status/:id` endpoint to allow the frontend to poll for job progress.
    - **Test:** Write an integration test using Jest and `supertest` that creates a journal and then calls this endpoint to check its initial `PENDING` status.
    - **Commit:** `feat(api): P3_T3 implement journal status polling endpoint`

### **Phase 4: Security Hardening Sprint**

**Goal:** To implement critical security and privacy enhancements to the backend API before the frontend UI is fully wired up. This ensures we are building on a secure-by-design foundation and addresses key architectural gaps identified in the initial plan. This phase must be completed before proceeding with the main frontend implementation.

---

**Task 1: Implement Data Privacy via Cascading Deletes (Data Model)**

- **Objective:** This is a critical privacy fix. We must ensure that when a user deletes their account, all of their associated sensitive data (journals, glycemic event clusters) is automatically and permanently removed from the database. Currently, this data would be "orphaned," which is a significant privacy violation.
- **Action (Schema Modification):**
  1.  Open the `goodnumbers/prisma/schema.prisma` file.
  2.  Locate the `Journal` model. Add the `onDelete: Cascade` directive to the `user` relation. The line should look like this:
      `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
  3.  Locate the `GlycemicEventCluster` model. Add `onDelete: Cascade` to the `journal` relation. The line should look like this:
      `journal Journal @relation(fields: [journalId], references: [id], onDelete: Cascade)`
- **Action (Database Migration):**
  1.  After saving the schema changes, open your terminal in the `goodnumbers` directory.
  2.  Run the following command to create and apply a new database migration: `npx prisma migrate dev --name feat-cascading-deletes`.
- **Action (Documentation):**
  1.  Update the Prisma schema code block in `docs/TECHNICAL_SPECIFICATION.md` to reflect these changes.
  2.  Add comments to the schema in the document explaining _why_ the cascading deletes are critical for user privacy and data integrity.
- **Test (Integration):**
  1.  Write a new integration test that creates a `User`, an associated `Journal`, and an associated `GlycemicEventCluster`.
  2.  In the test, delete the `User` record you created.
  3.  Finally, query the database for the `Journal` by its ID and assert that the result is `null`. This proves the cascading delete was successful.
- **Commit:** `feat(db): P4_T1 add cascading deletes for user privacy`

---

**Task 2: Remediate PII in Server Logs (Authentication)**

- **Objective:** Enhance user privacy and reduce security risk by removing all Personally Identifiable Information (PII), specifically user emails, from all server-side logs. Logging PII is a risk, especially as we prepare for production logging systems.
- **Action (Code Modification):**
  1.  Open the `goodnumbers/src/lib/auth.ts` file.
  2.  Carefully review the `signIn` callback function.
  3.  Locate all `console.log` and `console.error` statements.
  4.  Replace every instance of logging the `userEmail` variable with the non-identifiable `userId` variable. The `userId` provides the necessary traceability for debugging without exposing sensitive PII.
- **Test (Manual Verification):**
  1.  Run the application locally.
  2.  Attempt to log in with a Google account that is **on** the allowlist.
  3.  Attempt to log in with a Google account that is **not on** the allowlist.
  4.  Observe the server console output for both attempts. Verify that no email addresses are printed in any of the logs; only user IDs should be visible.
- **Commit:** `fix(auth): P4_T2 remove pii from server logs`

---

**Task 3: Implement Backend Agreement Enforcement (Authorization)**

- **Objective:** Fix the critical security vulnerability of relying on the frontend to enforce the agreement gate. This change moves all authorization logic to the server, adhering to the "Never Trust the Client" security principle.
- **Action (Create Middleware):**
  1.  Create a new file at `goodnumbers/src/middleware/enforceAgreements.ts`.
  2.  In this file, implement an Express middleware function that checks the database for the `agreementsSigned` flag of the currently authenticated user (`req.auth.user.id`).
  3.  If the flag is `false` or the user record is not found, the middleware must immediately end the request-response cycle by returning a `403 Forbidden` status with a clear JSON error message and code (e.g., `{ "message": "...", "code": "AGREEMENTS_NOT_SIGNED" }`).
- **Action (Apply Middleware):**
  1.  In `goodnumbers/src/index.ts`, import the new `enforceAgreements` middleware. Apply it to the entire `/api/journals` route group. The order is critical: `app.use('/api/journals', protect, enforceAgreements, ...)`.
  2.  In `goodnumbers/src/routes/user.ts`, import the new middleware. Apply it _individually_ to the sensitive endpoints that require agreements: `DELETE /me`, `PUT /settings`, and `POST /regenerate-rss-token`. The `/session-status` and `/agreements` endpoints are intentionally left without this middleware so the user can check their status and sign the agreements.
- **Test (Integration):**
  1.  **Red:** Write an integration test where you create a user with `agreementsSigned: false`. Make a request to a protected endpoint (e.g., `PUT /api/user/settings`). Assert that the response status is exactly `403`.
  2.  **Green:** In the same test, update the user record in the database, setting `agreementsSigned: true`. Make the same request again to `PUT /api/user/settings` and assert that it now succeeds with a `200` status.
- **Commit:** `feat(security): P4_T3 add middleware to enforce agreements on backend`

### **Phase 5: Frontend Implementation**

**Goal:** Build the user interface, connecting it to the now-stable backend API.

1.  **Task: Build Foundational UI & Login Flow**

    - **Action:** Set up the React project, routing, and a main layout component (header, footer).
    - **Action:** Build the UI for the login flow, the post-login agreements page, and the account setup page. Wire these up to the corresponding backend APIs.
    - **Test:** Use Jest and React Testing Library for component tests. Use Playwright for E2E tests to validate the forms and user flows.
    - **Commit:** `feat(ui): P4_T1 implement core layout and authentication flow`

2.  **Task: Build Dashboard & Journal Pages**
    - **Action:** Create the Dashboard page, fetching and displaying the list of past journals.
    - **Action:** Implement the "Start Journal" button, which navigates to the loading page.
    - **Action:** Build the journal loading page that polls the status endpoint.
    - **Action:** Build the main journal view page with all its components (AGP chart, inputs, etc.), fetching data from the `GET /api/journals/:id` endpoint.
    - **Test:** Write component tests with Jest/React Testing Library and E2E tests with Playwright for these pages to ensure data is displayed correctly and user interactions work as expected.
    - **Commit:** `feat(ui): P4_T2 implement dashboard and journal view pages`

### **Phase 6: Background Processing Implementation**

**Goal:** Implement the core data processing logic inside the background worker.

1.  **Task: Implement Data Fetching & Analysis**

    - **Action:** In the background worker, implement the logic to fetch data from a user's Nightscout instance (decrypting credentials first).
    - **Action:** Integrate the existing analysis scripts to process the raw data into structured insights and `TimeCluster` objects.
    - **Test:** Write unit tests using Jest for the data fetching and analysis pipeline, heavily mocking the external Nightscout API.
    - **Commit:** `feat(worker): P5_T1 implement nightscout data fetching and statistical analysis`

2.  **Task: Implement AI & TTS Pipeline**

    - **Action:** Implement the multi-pass Gemini calls to generate the script and description.
    - **Action:** Implement the call to the TTS service to generate the audio file.
    - **Action:** Implement robust error handling for each step of this pipeline.
    - **Test:** Write integration tests using Jest for this pipeline, mocking the Gemini and TTS APIs to ensure the flow works and that errors are handled gracefully.
    - **Commit:** `feat(worker): P5_T2 implement ai and tts generation pipeline`

3.  **Task: Finalize Job and Update Database**
    - **Action:** Implement the final step in the worker, where all generated artifacts (podcast URL, chart data, etc.) are saved to the `Journal` and `GlycemicEventCluster` tables in the database. The journal `status` should be updated to `COMPLETE`.
    - **Test:** Write a full integration test using Jest for the background worker that runs through the entire (mocked) process and verifies that the database is updated correctly at the end.
    - **Commit:** `feat(worker): P5_T3 finalize job by saving all generated data`

## 5. Deployment and Security Hardening

This section outlines high-level tasks that should be addressed as part of the production deployment process.

- **Production Secrets Management:** For the production GCE instance, secrets such as the `ENCRYPTION_KEY` and session secrets should be managed via Google Secret Manager, not from a `.env` file. The application should be configured with the appropriate permissions to fetch these secrets at startup.

- **Database File Permissions:** The deployment process must include a step to configure the file system permissions of the SQLite database file (e.g., `chmod 600 prisma/dev.db`). The file should only be readable and writable by the user account running the application.

- **Auth.js Production Configuration:**
  - **Google Cloud Project:** Ensure you are using the correct Google Cloud project for production (`goodnumbers`, not `goodnumbers-dev`).
  - **OAuth Credentials:**
    - In the Google Cloud Console, under "APIs & Services" -> "Credentials", create a new OAuth 2.0 Client ID for the production application.
    - The `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables for the production instance **must** be sourced from this new credential. These should be stored securely in Google Secret Manager.
  - **Authorized Redirect URIs:**
    - When creating the new OAuth credential, you must add the production application's redirect URI to the "Authorized redirect URIs" list. The URI follows the format: `https://<your-production-domain>/api/auth/callback/google`. For example: `https://goodnumbers.io/api/auth/callback/google`.
  - **AUTH_SECRET:** For security, Auth.js uses a secret to sign cookies and tokens. Ensure a strong, unique `AUTH_SECRET` environment variable is set in the production environment, managed via Google Secret Manager.
  - **NODE_ENV:** The `NODE_ENV` environment variable must be set to `production`. This enables various optimizations and security features within Express and Auth.js.

### Phase 6: Operational Hardening

**Goal:** Enhance application observability and security posture by implementing a robust, production-grade logging solution.

1.  **Task: Implement Production Logging Solution**
    - **Action:** Research and select a suitable logging library (e.g., Winston, Pino) for Node.js.
    - **Action:** Integrate the chosen library into the application, replacing all `console.log` and `console.error` calls with the new logger.
    - **Action:** Configure the logger for structured logging (e.g., JSON format).
    - **Action:** Ensure logs include relevant context (e.g., request ID, user ID, timestamp, log level).
    - **Action:** Configure log transport to a persistent storage solution (e.g., file system, cloud logging service like Google Cloud Logging).
    - **Action:** Update the global error handler (`errorHandler.ts`) to use the new logging solution.
    - **Test:**
      - Verify that logs are generated in the correct format and contain expected context.
      - Confirm that errors are properly captured and logged by the new system.
      - (Manual) Verify logs are accessible in the chosen storage solution.
    - **Commit:** `feat(ops): P6_T1 implement production logging solution`
