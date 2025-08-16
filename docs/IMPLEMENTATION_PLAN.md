# Goodnumbers Implementation Plan

**Version:** 1.2
**Date:** 2025-08-13

## 1. Overview

This document outlines the phased, step-by-step implementation plan for the Goodnumbers project. The plan follows a measured, test-driven approach, ensuring that each component is built and verified before moving to the next. Each task should be developed on a dedicated feature branch and merged into the `develop` branch via a Pull Request, as defined in `DEVELOPMENT_PROCESS.md`.

## 2. Testing Strategy

To support the MVP goals of stability and quality without undue complexity, this project will adopt a pragmatic, multi-layered testing strategy that introduces tools and techniques incrementally as features are developed.

### 2.1. Philosophy

- **Pragmatic for MVP:** The focus is on creating a robust safety net for core logic and preventing regressions, not achieving 100% test coverage.
- **Incremental Complexity:** Testing tools and patterns will be introduced in the phase where they are first needed, avoiding upfront overhead.

### 2.2. Levels of Testing & Tooling

1.  **Unit Testing:**

    - **Goal:** To test the smallest pieces of logic (e.g., a single utility function) in complete isolation.
    - **Tool:** **Jest** will be used for its test runner, assertion library (`expect`), and mocking capabilities.

2.  **Integration Testing:**

    - **Goal:** To test how multiple units work together.
    - **Backend Tools:** **Jest** and **`supertest`** will be used to test Express API endpoints, ensuring the HTTP layer, middleware, and service logic function correctly as a group.
    - **Frontend Tools:** **Jest** and **React Testing Library** will be used to test React components, ensuring they render and behave correctly from a user's perspective.

3.  **End-to-End (E2E) Testing:**
    - **Goal:** To test critical user journeys from start to finish in a real browser environment.
    - **Tool:** **Playwright** will be used to automate browser actions and validate complete workflows (e.g., login -> create journal -> view result). This will be introduced in Phase 4.

### 2.3. Testing Conventions

- **Directory Structure:** All test files will reside in a top-level `tests/` directory within the `goodnumbers` project folder. This directory will be further organized into `unit/` and `integration/` subdirectories.
- When running npm for the new goodnumbers project, always always always append "cd goodnumbers &&" first so it runs in the right folder.
- **File Naming:** Test files should be named to correspond with the module they are testing (e.g., `database.test.ts`, `encryption.test.ts`).
- **Database Files:** Local development database files (e.g., `goodnumbers/prisma/dev.db`) are ephemeral and must be added to the `.gitignore` file. The schema is managed solely through version-controlled migration files.

## 3. Task-Level Workflow

For each task listed in the implementation phases below, the following GitHub-integrated workflow must be followed:

1.  **Create an Issue:** Before beginning work, create a GitHub Issue to track the task. This can be done via the `gh` command-line tool. The issue will serve as a central place for discussion and to document specific implementation details.

    ```bash
    # Example for Phase 1, Task 2
    gh issue create --title "feat(db): Implement Database Schema" --body "Implement the Prisma schema as defined in the technical specification. Run the initial migration to set up the database."
    ```

2.  **Create a Branch:** Create a feature branch from the `develop` branch. It is recommended to include the issue number in the branch name for easy tracking.

    ```bash
    # Example assuming the issue created is #1
    git checkout -b feat/1-database-schema
    ```

3.  **Implement and Test:** Adhere to a "test-first" approach. The general workflow for a task should be:
    a. **Red:** Write a failing test that defines the desired functionality.
    b. **Green:** Write the simplest implementation code to make the test pass.
    c. **Refactor:** Clean up the implementation, ensuring the test still passes.

    Make small, atomic commits using the Conventional Commit standard.

4.  **Open a Pull Request:** Once the task is complete and all local tests are passing, open a Pull Request against the `develop` branch. The PR description should link to the issue it resolves using a keyword like `Closes #1`.

    ```bash
    gh pr create --base develop --title "feat(db): Implement Database Schema" --body "Closes #1. This PR adds the initial Prisma schema and migration."
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

### **Phase 1: Project Setup & Core Backend Foundation**

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

**Goal:** Implement all functionality related to user identity, from the initial access barrier to managing user-specific settings.

1.  **Task: Implement Pre-Release Access Barrier**

    - **Goal:** Create a site-wide password barrier to restrict access during the private beta, following a strict Test-Driven Development (TDD) approach as outlined in the project's development process.

    - **Step 1: Create Test File and Initial Failing Tests (The "Red" Step)**
        - **Action:** First, create a new integration test file at `goodnumbers/tests/integration/barrier.test.ts`.
        - **Action:** Inside this file, write your first test case using Jest and `supertest`. This test should define the primary requirement: "a request to a protected route (e.g., `/health`) without a session cookie should redirect to the login page". The test will attempt to make a GET request and will expect a 302 redirect status code to `/barrier-login.html`.
        - **Action:** Write a second failing test case: "a POST request to `/api/barrier-login` with incorrect credentials should return a 401 Unauthorized status".
        - **Action:** Run the test suite (`cd goodnumbers && npm test`) and watch it fail. This is the expected and desired outcome of the "Red" step.

    - **Step 2: Minimal Implementation to Pass Tests (The "Green" Step)**
        - **Action:** Install the required dependencies in the `goodnumbers/` directory: `npm install cookie-session @types/cookie-session`.
        - **Action:** Create the stub login page at `goodnumbers/public/barrier-login.html` and configure `express.static` in `src/index.ts`. This ensures the redirect target exists.
        - **Action:** Update the `.env.example` file with `BARRIER_USERNAME`, `BARRIER_PASSWORD`, and `COOKIE_SECRET`.
        - **Action:** Now, write the *absolute minimum* amount of code in `src/index.ts` to make the tests pass. This includes:
            - Adding the `cookie-session` middleware.
            - Creating a basic barrier middleware that redirects all unauthorized traffic.
            - Creating the `POST /api/barrier-login` route that initially might just return a hardcoded 401 error.
        - **Action:** Run the tests (`cd goodnumbers && npm test`) again. Iterate on your minimal implementation until the initial tests turn green.

    - **Step 3: Add Remaining Test Cases and Implement Logic (Repeat Red->Green)**
        - **Action:** Now, add the remaining test cases to `barrier.test.ts`:
            - A test for a *successful* login, asserting a 200 status and that the `Set-Cookie` header is present for `barrier_session`.
            - A test to ensure that after a successful login, a subsequent request to a protected route returns a 200 OK status instead of redirecting.
        - **Action:** Run the tests again; the new ones should fail.
        - **Action:** Now, implement the complete logic for the middleware and the API endpoint. This includes `zod` validation, checking credentials against environment variables, and setting `req.session.is_authorized = true` on success.
        - **Action:** Continue to run the tests until all of them pass.

    - **Step 4: Refactor**
        - **Action:** With a full suite of passing tests as your safety net, you can now refactor the implementation for clarity and quality.
        - **Action:** Review the code in `src/index.ts`. Consider moving the barrier middleware and the auth route handler to their own dedicated files (e.g., `src/middleware/auth.ts`, `src/routes/barrier.ts`) to keep the main application file clean.
        - **Action:** After each refactoring change, run the test suite (`cd goodnumbers && npm test`) to ensure you haven't broken anything.

    - **Commit:** `feat(auth): implement pre-release site access barrier`

2.  **Task: Integrate User Authentication (Auth.js)**

    - **Action:** Configure Auth.js with the Google Provider and the Prisma adapter. This will handle the user-facing login flow and the creation of `User`, `Account`, and `Session` records.
    - **Test:** This is primarily a manual test. Run the application, go through the Google sign-in flow, and verify in the database that the user records are created correctly.
    - **Commit:** `feat(auth): integrate auth.js for user authentication`

3.  **Task: Implement User Settings API**

    - **Action:** Create the `PUT /api/user/settings` endpoint. This endpoint will handle updates to `preferredUnits` and will use the encryption utility to securely save the `nightscoutUrl` and `nightscoutToken`. The request body must be validated using `zod`.
    - **Test:** Write an integration test using Jest and `supertest` that mocks an authenticated user, calls the endpoint with new settings, and then queries the database directly to verify the data was saved correctly (and that credentials are encrypted).
    - **Commit:** `feat(api): implement endpoint for user settings`

4.  **Task: Implement RSS Token Regeneration**
    - **Action:** Create the `POST /api/user/regenerate-rss-token` endpoint.
    - **Test:** Write an integration test using Jest and `supertest` that gets a user's original token, calls the endpoint, and asserts that the token stored in the database has changed.
    - **Commit:** `feat(api): add endpoint for rss token regeneration`

### **Phase 3: Core Journal Feature (Backend API)**

**Goal:** Build out all the backend API endpoints related to the journal lifecycle. At the end of this phase, the backend will be ready, but the actual data processing will not be implemented yet.

1.  **Task: Implement Journal CRUD APIs**

    - **Action:** Implement the foundational journal endpoints: `POST`, `GET` (list), `GET` (by ID), `PUT`, and `DELETE` for `/api/journals`. All endpoints accepting data must use `zod` for validation.
    - **Test:** Write integration tests using Jest and `supertest` for each endpoint. Crucially, ensure that ownership is enforced (a user cannot access or modify another user's journals).
    - **Commit:** `feat(api): implement crud api for journals`

2.  **Task: Set Up Background Job Queue**

    - **Action:** Integrate BullMQ and configure its connection to a Redis instance.
    - **Action:** Modify the `POST /api/journals` endpoint to enqueue a new job with the `journalId` upon successful creation.
    - **Action:** Create a skeleton background worker that listens to the queue and logs the ID of any received job.
    - **Test:** Write an integration test that calls the journal creation API and then checks the queue (via a Redis client) to confirm a job was successfully enqueued.
    - **Commit:** `feat(worker): integrate bullmq for background job processing`

3.  **Task: Implement Journal Status API**
    - **Action:** Create the `GET /api/journal-status/:id` endpoint to allow the frontend to poll for job progress.
    - **Test:** Write an integration test using Jest and `supertest` that creates a journal and then calls this endpoint to check its initial `PENDING` status.
    - **Commit:** `feat(api): implement journal status polling endpoint`

### **Phase 4: Frontend Implementation**

**Goal:** Build the user interface, connecting it to the now-stable backend API.

1.  **Task: Build Foundational UI & Login Flow**

    - **Action:** Set up the React project, routing, and a main layout component (header, footer).
    - **Action:** Build the UI for the login flow, the post-login agreements page, and the account setup page. Wire these up to the corresponding backend APIs.
    - **Test:** Use Jest and React Testing Library for component tests. Use Playwright for E2E tests to validate the forms and user flows.
    - **Commit:** `feat(ui): implement core layout and authentication flow`

2.  **Task: Build Dashboard & Journal Pages**
    - **Action:** Create the Dashboard page, fetching and displaying the list of past journals.
    - **Action:** Implement the "Start Journal" button, which navigates to the loading page.
    - **Action:** Build the journal loading page that polls the status endpoint.
    - **Action:** Build the main journal view page with all its components (AGP chart, inputs, etc.), fetching data from the `GET /api/journals/:id` endpoint.
    - **Test:** Write component tests with Jest/React Testing Library and E2E tests with Playwright for these pages to ensure data is displayed correctly and user interactions work as expected.
    - **Commit:** `feat(ui): implement dashboard and journal view pages`

### **Phase 5: Background Processing Implementation**

**Goal:** Implement the core data processing logic inside the background worker.

1.  **Task: Implement Data Fetching & Analysis**

    - **Action:** In the background worker, implement the logic to fetch data from a user's Nightscout instance (decrypting credentials first).
    - **Action:** Integrate the existing analysis scripts to process the raw data into structured insights and `TimeCluster` objects.
    - **Test:** Write unit tests using Jest for the data fetching and analysis pipeline, heavily mocking the external Nightscout API.
    - **Commit:** `feat(worker): implement nightscout data fetching and statistical analysis`

2.  **Task: Implement AI & TTS Pipeline**

    - **Action:** Implement the multi-pass Gemini calls to generate the script and description.
    - **Action:** Implement the call to the TTS service to generate the audio file.
    - **Action:** Implement robust error handling for each step of this pipeline.
    - **Test:** Write integration tests using Jest for this pipeline, mocking the Gemini and TTS APIs to ensure the flow works and that errors are handled gracefully.
    - **Commit:** `feat(worker): implement ai and tts generation pipeline`

3.  **Task: Finalize Job and Update Database**
    - **Action:** Implement the final step in the worker, where all generated artifacts (podcast URL, chart data, etc.) are saved to the `Journal` and `GlycemicEventCluster` tables in the database. The journal `status` should be updated to `COMPLETE`.
    - **Test:** Write a full integration test using Jest for the background worker that runs through the entire (mocked) process and verifies that the database is updated correctly at the end.
    - **Commit:** `feat(worker): finalize job by saving all generated data`

## 5. Deployment and Security Hardening

This section outlines high-level tasks that should be addressed as part of the production deployment process.

- **Production Secrets Management:** For the production GCE instance, secrets such as the `ENCRYPTION_KEY` and session secrets should be managed via Google Secret Manager, not from a `.env` file. The application should be configured with the appropriate permissions to fetch these secrets at startup.

- **Database File Permissions:** The deployment process must include a step to configure the file system permissions of the SQLite database file (e.g., `chmod 600 prisma/dev.db`). The file should only be readable and writable by the user account running the application.
