# Goodnumbers Implementation Plan

**Version:** 1.2
**Date:** 2025-08-13

## 1. Overview

This document outlines the phased, step-by-step implementation plan for the Goodnumbers project. The plan follows a measured, test-driven approach, ensuring that each component is built and verified before moving to the next. Each task should be developed on a dedicated feature branch and merged into the `develop` branch via a Pull Request, as defined in `DEVELOPMENT_PROCESS.md`.

## 2. Task-Level Workflow

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

3.  **Implement and Test:** Perform the actions for the task, adhering to the test-driven principles. Make small, atomic commits using the Conventional Commit standard.

4.  **Open a Pull Request:** Once the task is complete and all local tests are passing, open a Pull Request against the `develop` branch. The PR description should link to the issue it resolves using a keyword like `Closes #1`.

    ```bash
    gh pr create --title "feat(db): Implement Database Schema" --body "Closes #1. This PR adds the initial Prisma schema and migration."
    ```

5.  **Review and Merge:** Follow the PR review and merge process defined in `DEVELOPMENT_PROCESS.md`. The merge will automatically close the associated issue.

---

## 3. Implementation Phases

### **Phase 0: Project Restructuring**

**Goal:** Archive the existing proof-of-concept code to prepare for a clean, new implementation from the project root, while preserving the old code for reference.

1.  **Task: Archive Existing Proof of Concept**
    - **Action:** Create a new directory at the project root named `proof_of_concept`.
    - **Action:** Move all contents of the existing `goodnumbers/` directory into the new `proof_of_concept/` directory.
    - **Test:** Manually verify that the file move is complete and the `goodnumbers/` directory is gone.
    - **Commit:** `chore: Archive existing proof-of-concept code`

### **Phase 1: Project Setup & Core Backend Foundation**

**Goal:** Establish a runnable server, a database schema, and core utilities. This phase ensures the absolute fundamentals are working before any feature logic is added.

1.  **Task: Initialize Project & Dependencies**

    - Make a new subfolder calld 'goodnumbers' which will be the project root
    - **Action:** Set up the Node.js project (`npm init`), install core dependencies (Express, Prisma, TypeScript), and configure project files (`tsconfig.json`, `.pylintrc`, `.prettierrc`).
    - **Test:** Confirm the project compiles (`tsc`) and lints without errors.
    - **Commit:** `chore: Initial project setup and configuration`

2.  **Task: Implement Database Schema**

    - **Action:** Create the `prisma/schema.prisma` file with the `User`, `Journal`, `GlycemicEventCluster`, and Auth.js models as specified.
    - **Action:** Run the initial database migration (`prisma migrate dev`) to create the SQLite database file and generate the Prisma client.
    - **Test:** Write a simple automated test that uses the Prisma client to connect to the database and perform a basic query (e.g., `prisma.user.count()`).
    - **Commit:** `feat(db): implement initial prisma schema`

3.  **Task: Create Basic Express Server**

    - **Action:** Set up a minimal Express server application that listens on a port.
    - **Action:** Create a public `/health` endpoint that returns a `200 OK` with a JSON body like `{"status": "ok"}`.
    - **Test:** Write an integration test (e.g., using `supertest`) that makes a request to the `/health` endpoint and asserts the response is correct.
    - **Commit:** `feat(server): add basic express server with health check`

4.  **Task: Build Credential Encryption Utility**
    - **Action:** Create a self-contained utility module (`encryption.ts`) with `encrypt` and `decrypt` functions using Node.js's built-in `crypto` module, as specified for handling Nightscout credentials.
    - **Test:** Write unit tests for the encryption utility. Ensure that `decrypt(encrypt(data))` returns the original data. Test edge cases like empty or null inputs.
    - **Commit:** `feat(utils): create encryption utility for sensitive data`

### **Phase 2: Authentication & User Management**

**Goal:** Implement all functionality related to user identity, from the initial access barrier to managing user-specific settings.

1.  **Task: Implement Pre-Release Access Barrier**

    - **Action:** Implement the Express middleware to intercept all requests, check for a valid session cookie, and redirect to a login page if absent. Credentials should be loaded from environment variables.
    - **Action:** Create the `POST /api/barrier-login` endpoint to validate credentials and set the cookie.
    - **Test:** Write integration tests for the middleware. Test that a protected route redirects. Test that the login endpoint correctly sets a cookie on success and returns an error on failure.
    - **Commit:** `feat(auth): implement pre-release site access barrier`

2.  **Task: Integrate User Authentication (Auth.js)**

    - **Action:** Configure Auth.js with the Google Provider and the Prisma adapter. This will handle the user-facing login flow and the creation of `User`, `Account`, and `Session` records.
    - **Test:** This is primarily a manual test. Run the application, go through the Google sign-in flow, and verify in the database that the user records are created correctly.
    - **Commit:** `feat(auth): integrate auth.js for user authentication`

3.  **Task: Implement User Settings API**

    - **Action:** Create the `PUT /api/user/settings` endpoint. This endpoint will handle updates to `preferredUnits` and will use the encryption utility to securely save the `nightscoutUrl` and `nightscoutToken`.
    - **Test:** Write an integration test that mocks an authenticated user, calls the endpoint with new settings, and then queries the database directly to verify the data was saved correctly (and that credentials are encrypted).
    - **Commit:** `feat(api): implement endpoint for user settings`

4.  **Task: Implement RSS Token Regeneration**
    - **Action:** Create the `POST /api/user/regenerate-rss-token` endpoint.
    - **Test:** Write an integration test that gets a user's original token, calls the endpoint, and asserts that the token stored in the database has changed.
    - **Commit:** `feat(api): add endpoint for rss token regeneration`

### **Phase 3: Core Journal Feature (Backend API)**

**Goal:** Build out all the backend API endpoints related to the journal lifecycle. At the end of this phase, the backend will be ready, but the actual data processing will not be implemented yet.

1.  **Task: Implement Journal CRUD APIs**

    - **Action:** Implement the foundational journal endpoints: `POST`, `GET` (list), `GET` (by ID), `PUT`, and `DELETE` for `/api/journals`.
    - **Test:** Write integration tests for each endpoint. Crucially, ensure that ownership is enforced (a user cannot access or modify another user's journals).
    - **Commit:** `feat(api): implement crud api for journals`

2.  **Task: Set Up Background Job Queue**

    - **Action:** Integrate BullMQ and configure its connection to a Redis instance.
    - **Action:** Modify the `POST /api/journals` endpoint to enqueue a new job with the `journalId` upon successful creation.
    - **Action:** Create a skeleton background worker that listens to the queue and logs the ID of any received job.
    - **Test:** Write an integration test that calls the journal creation API and then checks the queue (via a Redis client) to confirm a job was successfully enqueued.
    - **Commit:** `feat(worker): integrate bullmq for background job processing`

3.  **Task: Implement Journal Status API**
    - **Action:** Create the `GET /api/journal-status/:id` endpoint to allow the frontend to poll for job progress.
    - **Test:** Write an integration test that creates a journal and then calls this endpoint to check its initial `PENDING` status.
    - **Commit:** `feat(api): implement journal status polling endpoint`

### **Phase 4: Frontend Implementation**

**Goal:** Build the user interface, connecting it to the now-stable backend API.

1.  **Task: Build Foundational UI & Login Flow**

    - **Action:** Set up the React project, routing, and a main layout component (header, footer).
    - **Action:** Build the UI for the login flow, the post-login agreements page, and the account setup page. Wire these up to the corresponding backend APIs.
    - **Test:** Use component tests (e.g., React Testing Library) and E2E tests (e.g., Playwright/Cypress) to validate the forms and user flows.
    - **Commit:** `feat(ui): implement core layout and authentication flow`

2.  **Task: Build Dashboard & Journal Pages**
    - **Action:** Create the Dashboard page, fetching and displaying the list of past journals.
    - **Action:** Implement the "Start Journal" button, which navigates to the loading page.
    - **Action:** Build the journal loading page that polls the status endpoint.
    - **Action:** Build the main journal view page with all its components (AGP chart, inputs, etc.), fetching data from the `GET /api/journals/:id` endpoint.
    - **Test:** Write component and E2E tests for these pages to ensure data is displayed correctly and user interactions work as expected.
    - **Commit:** `feat(ui): implement dashboard and journal view pages`

### **Phase 5: Background Processing Implementation**

**Goal:** Implement the core data processing logic inside the background worker.

1.  **Task: Implement Data Fetching & Analysis**

    - **Action:** In the background worker, implement the logic to fetch data from a user's Nightscout instance (decrypting credentials first).
    - **Action:** Integrate the existing analysis scripts to process the raw data into structured insights and `TimeCluster` objects.
    - **Test:** Write unit tests for the data fetching and analysis pipeline, heavily mocking the external Nightscout API.
    - **Commit:** `feat(worker): implement nightscout data fetching and statistical analysis`

2.  **Task: Implement AI & TTS Pipeline**

    - **Action:** Implement the multi-pass Gemini calls to generate the script and description.
    - **Action:** Implement the call to the TTS service to generate the audio file.
    - **Action:** Implement robust error handling for each step of this pipeline.
    - **Test:** Write integration tests for this pipeline, mocking the Gemini and TTS APIs to ensure the flow works and that errors are handled gracefully.
    - **Commit:** `feat(worker): implement ai and tts generation pipeline`

3.  **Task: Finalize Job and Update Database**
    - **Action:** Implement the final step in the worker, where all generated artifacts (podcast URL, chart data, etc.) are saved to the `Journal` and `GlycemicEventCluster` tables in the database. The journal `status` should be updated to `COMPLETE`.
    - **Test:** Write a full integration test for the background worker that runs through the entire (mocked) process and verifies that the database is updated correctly at the end.
    - **Commit:** `feat(worker): finalize job by saving all generated data`
