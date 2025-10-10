Of course. Here is the complete, updated `Docs/IMPLEMENTATION_PLAN.md` file with the new changes integrated.

# file: Docs/IMPLEMENTATION_PLAN.md

# Goodnumbers Implementation Plan

**Version:** 4.0 (Phase 3 Review & Frontend Planning Update)
**Date:** 2025-09-23

## 1. Overview

This document outlines the phased, step-by-step implementation plan for the Goodnumbers project. The plan follows a measured, test-driven approach, ensuring that each component is built and verified before moving to the next. Each task should be developed on a dedicated feature branch and merged into the appropriate development branch via a Pull Request, as defined in `DEVELOPMENT_PROCESS.md`.

## 2. Testing Strategy

To support the MVP goals of stability and quality without undue complexity, this project will adopt a pragmatic, multi-layered testing strategy that introduces tools and techniques incrementally as features are developed.

### 2.1. Philosophy

- **Pragmatic for MVP:** The focus is on creating a robust safety net for core logic and preventing regressions, not achieving 100% test coverage.
- **Incremental Complexity:** Testing tools and patterns will be introduced in the phase where they are first needed, avoiding upfront overhead.

### 2.2. Levels of Testing & Tooling

#### 2.2.1. A Two-Tier Approach to Integration Testing

For services that interact with external dependencies like a database or a Redis queue, we will adopt a two-tier integration testing strategy to balance speed and confidence:

1.  **Tier 1: Mocked Integration Tests (Fast Feedback)**
    - **Purpose:** To verify the application's internal logic and the "contract" between different parts of our code. For example, ensuring an API route correctly calls a specific function from our queue library.
    - **Mechanism:** We use Vitest's mocking capabilities (`vi.mock`) to replace the real external dependency with a controlled, in-memory version.
    - **Characteristics:** These tests are extremely fast, reliable, and can run in parallel without interfering with each other. They are ideal for running frequently during local development.
    - **Example:** `tests/integration/queue.test.ts`

2.  **Tier 2: "True" Integration Tests (High Confidence)**
    - **Purpose:** To verify the application's ability to correctly connect to, serialize data for, and interact with a real backing service (e.g., the Redis server running in Docker).
    - **Mechanism:** These tests run against a live service. They use environment variables to configure the application to use a unique, isolated namespace (like a specific queue name) for the duration of the test run.
    - **Characteristics:** These tests are slower and require the external dependency to be running. They provide the highest level of confidence that the entire integrated system works as expected. They are critical for our CI/CD pipeline before a deployment.
    - **Example:** `tests/integration/real-queue.test.ts`

3.  **Unit Testing:**
    - **Goal:** To test the smallest pieces of logic (e.g., a single utility function) in complete isolation.
    - **Tool:** **Vitest** will be used for its test runner, assertion library (`expect`), and mocking capabilities.

4.  **Integration Testing:**
    - **Goal:** To test how multiple units work together.
    - **Backend Tools:** **Vitest** and **`supertest-session`** will be used to test Express API endpoints. `supertest-session` is critical for correctly managing cookies and state in tests involving authentication and CSRF protection.
    - **Frontend Tools:** **Vitest** and **React Testing Library** will be used to test React components, ensuring they render and behave correctly from a user's perspective.

5.  **End-to-End (E2E) Testing:**
    - **Goal:** To test critical user journeys from start to finish in a real browser environment.
    - **Tool:** **Playwright** will be used to automate browser actions and validate complete workflows (e.g., login -> create journal -> view result). This will be introduced in Phase 5.

### 2.3. Testing Conventions

- **Directory Structure:** All test files will reside in a top-level `tests/` directory within the `goodnumbers` project folder. This directory will be further organized into `unit/` and `integration/` subdirectories.
- When running npm for the new goodnumbers project, always always always append "cd goodnumbers &&" first so it runs in the right folder.
- **File Naming:** Test files should be named to correspond with the module they are testing (e.g., `database.test.ts`, `encryption.test.ts`).
- **Database Files:** Local development database files (e.g., `goodnumbers/prisma/dev.db`) are ephemeral and must be added to the `.gitignore` file. The schema is managed solely through version-controlled migration files.

#### 2.3.1. Integration Test Server Lifecycle

For integration tests that require a running Express server with session management, the following `beforeEach`/`afterEach` pattern **must** be used with `supertest-session`.

````typescript
// **UPDATED: This example now uses supertest-session for robust state management.**
import session from "supertest-session";
import { createApp } from "../../src/index.ts";
import * as http from "http";
import type { Express } from "express";

let server: http.Server;
let agent: session.Session; // Use the session type
let app: Express;

beforeEach((done) => {
  // 1. Create a fresh app instance for this test.
  app = createApp();

  // 2. Start the server on a random, available port.
  server = app.listen(0, () => {
    // 3. Create a session agent bound to this server instance.
    // This agent will manage cookies and session state for the entire test block.
    agent = session(app);

    // 4. Perform any other async setup (like database seeding or fetching a CSRF token).
    // ... then call done() to signal Jest to start the test.
    done();
  });
});

afterEach((done) => {
  // 5. Close the server after each test to prevent hanging processes.
  server.close(done);
});```

- **Key Principles:**
  - **Isolation:** A fresh server instance is created and destroyed for _each_ test.
  - **`supertest-session` Agent:** Using `session(app)` is crucial for stateful testing. It automatically persists cookies (like session and CSRF tokens) across multiple requests within a single `it` block, perfectly mimicking a real browser session.
  - **Asynchronous Setup:** The `done()` callback is essential for managing asynchronous setup and teardown.

### 2.4. Mocking with ES Modules

When using ES Modules (`"type": "module"` in `package.json`), mocking modules requires careful consideration. Vitest provides a robust mocking API.

**Recommended Approach:**

To reliably mock modules in an ES Module environment, use `vi.mock()` combined with dynamic `import()`.

**Example (`auth.test.ts`):**

```typescript
import { vi, describe, it, expect } from "vitest";

// Mock fs/promises *before* importing the auth module
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

// Dynamically import the modules
const { readFile } = await import("fs/promises");
const { authConfig } = await import("../../src/lib/auth"); // Assuming authConfig is the main export

describe("signIn callback", () => {
  it("should allow a user on the allowlist", async () => {
    // Configure the mock for this test
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue("user@example.com\n");

    // ... rest of the test
  });
});
````

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
    - **Action:** Install testing dependencies: `vitest`, `@vitest/coverage-v8`, `jsdom`, `prismock`, `supertest`.
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
    - **Action:** Set up a minimal Express server application. **Best Practice Update:** The server architecture should be split into two files for testability and clarity.
      - `src/index.ts`: This file defines and exports a `createApp()` factory function. It **does not** start a server itself, making it safe to import in test files.
      - `src/server.ts`: This file imports `createApp()` and calls `app.listen()` to start the server. This file serves as the application's main entry point.
    - **Action:** Add `helmet` and `express-rate-limit` middleware.
    - **Action:** Create a public `/health` endpoint.
    - **Action:** Install `zod` and establish a pattern for API input validation.
    - **Action:** Implement a global, catch-all error-handling middleware.
    - **Test:** In a new file at `goodnumbers/tests/integration/server.test.ts`, write a test using Vitest and `supertest` that imports `createApp` and asserts the `/health` endpoint is correct.
    - **Commit:** `feat(server): add basic express server with health check and security hardening`

4.  **Task: Build Credential Encryption Utility** - COMPLETE
    - **Action:** Create a self-contained utility module (`encryption.ts`) with `encrypt` and `decrypt` functions using Node.js's built-in `crypto` module, as specified for handling Nightscout credentials.
    - **Action:** Install and configure `dotenv` to load the `ENCRYPTION_KEY` from a `.env` file in the application's entry point.
    - **Test:** Write unit tests using Vitest for the encryption utility. Ensure that `decrypt(encrypt(data))` returns the original data. Test edge cases like empty or null inputs and initialization failures.
    - **Commit:** `feat(utils): create encryption utility for sensitive data`

---

### **Phase 2: Authentication & User Management (Auth.js v5)** - COMPLETE

**Goal:** To implement a secure, modern, and robust authentication and user management system using the official Auth.js v5 library for Express. This phase is critical and replaces all previous authentication logic.

#### **Task 1: Core Auth.js v5 Integration** - COMPLETE

- **Goal:** To install the necessary dependencies and configure the foundational pieces of Auth.js, including the database adapter and the main Express handler.
- **Commit:** `feat(auth): P2_T1 integrate authjs v5 core components`

#### **Task 2: Create a Placeholder UI for Login/Logout Testing** - COMPLETE

- **Goal:** To create a minimal frontend page to manually verify the end-to-end Google OAuth flow is working correctly before adding more complex logic.
- **Commit:** `feat(auth): P2_T2 add placeholder ui for testing auth flow`

#### **Task 3: Implement Email Allowlist** - COMPLETE

- **Goal:** To restrict application access to a predefined list of beta testers by implementing logic within the `signIn` callback.
- **Commit:** `feat(auth): P2_T3 implement email allowlist in signIn callback`

#### **Task 4: Implement Onboarding Enforcement Middleware** - COMPLETE

- **Goal:** To create a secure, server-side authorization layer that enforces the required user onboarding flow (Agreements -> Account Setup) before granting access to the main application.
- **Commit:** `feat(auth): P2_T4 implement onboarding enforcement middleware`

#### **Task 5: Implement User Settings API** - COMPLETE

- **Goal:** To create the `PUT /api/user/settings` endpoint, secured by the `protect` middleware, and refactor the old agreements endpoint.
- **Commit:** `feat(api): P2_T5 implement protected endpoint for user settings`

---

### **Phase 3: Core Journal Feature (Backend API)**

**Goal:** Build out all the backend API endpoints related to the journal lifecycle. At the end of this phase, the backend will be ready for the core feature, but the actual data processing will be deferred. This phase builds directly upon the secure, authenticated foundation from Phase 2.

#### **Phase 3 Pre-requisite: Create `phase3develop` Branch** - COMPLETE

- **Goal:** To create a clean, dedicated integration branch for Phase 3, preserving the state of the completed Phase 2.
- **Action:**

  ```bash
  # Ensure you have the latest version of the phase 2 branch
  git checkout phase2develop
  git pull origin phase2develop

  # Create and push the new branch for phase 3
  git checkout -b phase3develop
  git push origin phase3develop
  ```

- **Note:** All feature branches for Phase 3 tasks must be based on, and their Pull Requests must target, the `phase3develop` branch.

#### **Task 1: Implement Journal CRUD APIs** - COMPLETE

- **Goal:** Implement the foundational journal endpoints (`POST`, `GET` list, `GET` by ID, `PUT`, and `DELETE`) for `/api/journals`.
- **Implementation Details:**
  - **Security:** The entire `/api/journals` route group **must** be protected by the middleware chain: `protect`, `enforceOnboarding`, and **`csrfProtection`**. This ensures only authenticated, fully onboarded users can access these endpoints and prevents cross-site request forgery attacks.
  - **Data Segregation:** All database queries that access a specific journal (`GET /:id`, `PUT /:id`, `DELETE /:id`) **must** include a `userId` check in the `where` clause (e.g., `{ where: { id: journalId, userId: req.user.id } }`). This is a critical security measure to enforce data ownership.
  - **Input Validation:** For the `PUT /api/journals/:id` endpoint, create a new schema named `journalUpdateSchema` in `src/lib/validation.ts` using `zod`. This maintains our established pattern for secure and consistent input validation.
- **Test:** Write integration tests using `supertest-session` for each endpoint. Crucially, tests must verify that ownership is enforced and that CSRF protection rejects requests without a valid token.
- **Commit:** `feat(api): P3_T1 implement crud api for journals`

#### **Task 2: Set Up Background Job Queue** - COMPLETE

- **Goal:** Integrate a background job queue to handle the asynchronous, long-running process of journal generation, ensuring the web server remains responsive.
- **Implementation Details:**
  - **Dependencies:** Install `bullmq` and a Redis client such as `ioredis`. Add Redis connection details to the `.env` and `.env.example` files.
  - **Logic:** The `POST /api/journals` endpoint will be modified. Its sole responsibility will be to:
    1.  Create a `Journal` record in the database with an initial `status` of `PENDING`.
    2.  Enqueue a new job in the `journal-processing` queue, passing the `journalId` of the newly created record.
    3.  Return the new journal object to the client immediately.
  - **Worker:** Create a skeleton background worker process. This worker will connect to the Redis queue, listen for new jobs, and simply log the ID of any job it receives. The actual processing logic will be implemented in a later phase.
- **Test:** Write a new integration test that calls the `POST /api/journals` API and then uses a Redis client to connect to the test database and confirm that a job was successfully added to the queue with the correct journal ID.
- **Commit:** `feat(worker): P3_T2 integrate bullmq for background job processing`

#### **Task 3: Implement Journal Status API**

- **Goal:** Create an endpoint to allow the frontend to poll for the progress of a journal generation job.
- **Implementation Details:**
  - **API Design:** To follow RESTful best practices, the endpoint will be `GET /api/journals/:id/status`. This treats the status as a sub-resource of the journal.
  - **Logic:** The endpoint will query the database for the specified journal and return its `status`, `progress`, and `statusMessage` fields.
  - **Security:** This endpoint must also enforce user ownership to prevent one user from polling the status of another user's journal.
- **Test:** Write an integration test using Jest and `supertest` that first creates a journal (which will have a `PENDING` status) and then immediately calls this new status endpoint to verify the initial state is returned correctly.
- **Commit:** `feat(api): P3_T3 implement journal status polling endpoint`

### **Phase 4: Security Hardening Sprint**

**Goal:** To implement critical security and privacy enhancements to the backend API before the frontend UI is fully wired up. This ensures we are building on a secure-by-design foundation and addresses key architectural gaps identified in the initial plan. This phase must be completed before proceeding with the main frontend implementation.

---

**Task 1: Verify and Correct Cascading Deletes for Data Privacy**

- **Objective:** This task is a critical data-integrity and privacy fix. We must ensure that when a user or a journal is deleted, all of their associated sensitive data is automatically and permanently removed from the database to prevent orphaned records.
- **Action (Schema Modification & Correction):**
  1.  Open the `goodnumbers/prisma/schema.prisma` file.
  2.  **Verify:** Confirm that the `user` relation on the `Journal` model includes `onDelete: Cascade`.
  3.  **CORRECT (Bug Fix):** Locate the `GlycemicEventCluster` model. Add the `onDelete: Cascade` directive to the `journal` relation to fix a bug where clusters would be orphaned. The line should look like this:
      `journal Journal @relation(fields: [journalId], references: [id], onDelete: Cascade)`
- **Action (Database Migration):**
  1.  After saving the schema changes, run a new database migration to apply the fix: `npx prisma migrate dev --name fix-cluster-cascade-delete`.
- **Test (Integration):**
  1.  **Test 1 (Existing):** The test that deletes a `User` and asserts their `Journal` is deleted should still pass.
  2.  **Test 2 (New):** Write a new, specific integration test that:
      a. Creates a `User`, a `Journal`, and a `GlycemicEventCluster` associated with that journal.
      b. Deletes the `Journal` record.
      c. Queries the database for the `GlycemicEventCluster` by its ID and asserts that the result is `null`. This proves the fix is working.
- **Commit:** `fix(db): P4_T1 ensure cascading deletes on all child models`

---

**Task 2: Remediate PII in Server Logs (Authentication)** - COMPLETE

- **Objective:** Enhance user privacy and reduce security risk by removing all Personally Identifiable Information (PII), specifically user emails, from all server-side logs.
- **Status:** This task was proactively completed ahead of schedule during Phase 2 development. The `src/lib/auth.ts` file already correctly logs the non-identifiable `userId` instead of the user's email during login attempts. This is a great example of secure-by-default implementation.
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

### **Phase 5: Full-Stack Integration & UI Implementation**

**Goal:** To establish a robust monorepo architecture that allows for clean separation of concerns between the frontend and backend, while enabling type-safe code sharing. This phase will then proceed to build the foundational user interface, connecting it to the now-stable backend API.

---

#### **Task 1: Establish Monorepo with npm Workspaces**

- **Objective:** To restructure the project from a single-package setup into a multi-package monorepo using npm workspaces. This is the foundational step for all full-stack development.
- **Risks & Mitigations:**
  - **Risk:** Incorrectly configured `package.json` files can lead to dependency resolution issues.
    - **Mitigation:** This plan provides exact templates for the new configuration files. The engineer must follow the backup and migration steps precisely.
  - **Risk:** Confusion about where to run `npm` commands.
    - **Mitigation:** The plan includes new root-level scripts and documentation explaining that `npm install` must now be run from the project root.
- **Implementation Notes:**
  - This is primarily a file-moving and configuration task. It should be done on a dedicated branch.
  - **Crucial Naming Convention Change:** The existing backend directory, currently named `Frontend/`, **must** be renamed to `backend/` for clarity and to avoid confusion with the actual frontend application we are about to create.

##### **In-depth Engineering Plan (Task 1)**

**Step 1: Prepare the Workspace**

1.  **Backup:** Before starting, make a backup of your entire project directory.
2.  **Rename Backend Directory:** Rename the `Frontend/` directory at the project root to `backend/`.
3.  **Create Root `package.json`:** In the absolute root of your project, create a new `package.json` file. This file will define the monorepo workspaces.

    ```json
    // file: package.json
    {
      "name": "goodnumbers-monorepo",
      "version": "1.0.0",
      "private": true,
      "workspaces": ["backend", "frontend", "packages/*"],
      "scripts": {
        "dev:backend": "npm run dev -w backend",
        "dev:frontend": "npm run dev -w frontend",
        "build:backend": "npm run build -w backend",
        "build:frontend": "npm run build -w frontend",
        "test:backend": "npm test -w backend",
        "test:frontend": "npm test -w frontend",
        "lint": "npm run lint -ws --if-present",
        "postinstall": "npm run build -w @goodnumbers/schemas && npm run build -w @goodnumbers/types"
      },
      "devDependencies": {
        "typescript": "^5.9.2"
      }
    }
    ```

4.  **Create `packages` Directory:** At the project root, create a new empty directory named `packages/`.
5.  **Clean Up:** **Delete** the `node_modules` directory inside `backend/`. Also delete the `package-lock.json` file inside `backend/`. This is critical for npm to correctly hoist dependencies to the root.

**Step 2: Install Dependencies**

1.  **Install:** From the **project root**, run `npm install`. This will read the new root `package.json`, recognize the workspaces, and install all dependencies for the `backend` into a single, top-level `node_modules` directory.

**Step 3: Verify Installation**

1.  **Run Backend Tests:** From the **project root**, run the new workspace script: `npm test -w backend`. All existing backend tests should pass without any code changes. This confirms the workspace is correctly configured.
2.  **Commit:** `chore(repo): P5_T1 establish monorepo with npm workspaces`

---

#### **Task 2: Create Shared `@goodnumbers/schemas` Package**

- **Objective:** To extract the environment-agnostic Zod validation schemas into a dedicated, shared internal package that both the frontend and backend can consume.
- **Acceptance Gate:** The backend application must be refactored to import schemas from the new `@goodnumbers/schemas` package, and all backend integration tests must continue to pass.

##### **In-depth Engineering Plan (Task 2)**

**Step 1: Create the Package Structure**

1.  **Create Directories:** Inside the `packages/` directory, create the following structure: `schemas/src/`.
2.  **Create `package.json`:** Create a `package.json` for the new schemas package.

    ```json
    // file: packages/schemas/package.json
    {
      "name": "@goodnumbers/schemas",
      "version": "1.0.0",
      "private": true,
      "main": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc"
      },
      "dependencies": {
        "zod": "^4.1.8"
      },
      "devDependencies": {
        "typescript": "^5.9.2"
      }
    }
    ```

3.  **Create `tsconfig.json`:** Create a `tsconfig.json` to build this package.

    ```json
    // file: packages/schemas/tsconfig.json
    {
      "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "declaration": true,
        "outDir": "./dist",
        "strict": true,
        "esModuleInterop": true,
        "moduleResolution": "node"
      },
      "include": ["src"],
      "exclude": ["node_modules", "dist"]
    }
    ```

**Step 2: Migrate Code and Refactor Backend**

1.  **Move Code:** Move the contents of `backend/src/lib/validation.ts` into a new file at `packages/schemas/src/index.ts`. Delete the now-empty `backend/src/lib/validation.ts`.
2.  **Update Backend `package.json`:** Add the new package as a dependency.

    ```json
    // file: backend/package.json
    {
      // ... existing fields
      "dependencies": {
        // ... other dependencies
        "@goodnumbers/schemas": "workspace:*",
        "zod": "^4.1.8"
      }
      // ...
    }
    ```

3.  **Install:** From the project root, run `npm install`. This will symlink the new package.
4.  **Refactor All Imports:** Go through the backend code (`backend/src/routes/journal.ts`, `backend/src/routes/user.ts`) and change all relative imports from `../lib/validation.js` to `@goodnumbers/schemas`.
5.  **Run Tests:** Run `npm test -w backend` from the root. All tests should now pass.
6.  **Commit:** `feat(schemas): P5_T2 create shared schemas package`

---

#### \*\* Task 2.5: Migrate from jest to vitest

- Objective: Move from jest to vitest.

#### **Task 3: Create Shared `@goodnumbers/types` Package for Prisma**

- **Objective:** To configure Prisma to generate its client types into a shared package, allowing the frontend to import data types like `User` and `Journal` without bundling the Prisma client itself.
- **Acceptance Gate:** The backend can import Prisma types from `@goodnumbers/types` and all tests pass.

##### **In-depth Engineering Plan (Task 3)**

**Step 1: Create the Package Structure**

1.  **Create `package.json`:** Create a `package.json` for the new types package.

    ```json
    // file: packages/types/package.json
    {
      "name": "@goodnumbers/types",
      "version": "1.0.0",
      "private": true,
      "main": "dist/index.js",
      "types": "dist/index.d.ts",
      "scripts": {
        "build": "tsc"
      },
      "devDependencies": {
        "typescript": "^5.9.2"
      }
    }
    ```

2.  **Create `tsconfig.json` and a root `tsconfig.base.json`:**
    - **Base Config (in project root):**
      ```json
      // file: tsconfig.base.json
      {
        "compilerOptions": {
          "target": "ESNext",
          "module": "ESNext",
          "strict": true,
          "esModuleInterop": true,
          "skipLibCheck": true,
          "forceConsistentCasingInFileNames": true,
          "moduleResolution": "bundler"
        }
      }
      ```
    - **Package-specific Config:**
      ```json
      // file: packages/types/tsconfig.json
      {
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "outDir": "dist",
          "declaration": true
        },
        "include": ["src"]
      }
      ```

**Step 2: Configure Prisma Generator**

1.  **Update Schema:** Modify the Prisma schema to point its output to the new package. The relative path is crucial.

    ```prisma
    // file: backend/prisma/schema.prisma
    generator client {
      provider = "prisma-client-js"
      output   = "../packages/types/src/generated/client"
    }
    // ... rest of schema
    ```

2.  **Create Export File:** Create a file at `packages/types/src/index.ts` to re-export the generated types.

    ```typescript
    // file: packages/types/src/index.ts
    // This exports all the generated types like `User`, `Journal`, etc.
    export * from "./generated/client";
    ```

3.  **Generate Prisma Client:** From the `backend/` directory, run `npx prisma generate`. This will create the types in the new shared location.
4.  **Update Backend `package.json`:** Add the dependency.

    ```json
    // file: backend/package.json
     "dependencies": {
        // ... other dependencies
        "@goodnumbers/types": "workspace:*",
        // ...
      },
    ```

5.  **Install:** Run `npm install` from the root.

**Step 3: Refactor and Verify**

1.  **Refactor Backend:** In your backend code (e.g., `auth.ts`, tests), change imports like `import { User } from '@prisma/client'` to `import type { User } from '@goodnumbers/types'`. The runtime `prisma` instance should still be imported from your local `backend/src/lib/prisma.ts`.
2.  **Run Backend Tests:** Run `npm test -w backend`. Everything should pass.
3.  **Commit:** `feat(types): P5_T3 create shared types package for Prisma`

---

#### **Task 4: Initialize React Frontend Project** - **CURRENT TASK**

- **Goal:** To create the foundational project structure and development environment for our React single-page application (SPA).
- **Implementation Details:**
  - **Sub-Task 4.1: Project Scaffolding & Configuration:**
    - **Action:** Create a `frontend/` directory and use **Vite** to scaffold a new React+TypeScript project within it.
    - **Action:** Install core dependencies (`react-router-dom`, `axios`) and testing libraries (`vitest`, `@testing-library/react`, `jsdom`).
    - **Action:** In `frontend/package.json`, add the `@goodnumbers/schemas` and `@goodnumbers/types` as workspace dependencies, then run `npm install` from the root to link them.
    - **Action:** Configure the Vite dev server proxy in `frontend/vite.config.ts` to forward `/api` requests to the backend at `http://localhost:3000`.
    - **Action:** Create a `.env` file in `frontend/` for client-side environment variables.
  - **Sub-Task 4.2: Establish Core App Structure:**
    - **Action:** Create a basic directory structure: `src/components`, `src/pages`, `src/hooks`, `src/lib`.
    - **Action:** Implement a global CSS file (`src/index.css`) and define the color palette from the PRD as CSS variables for the design system.
    - **Action:** Create a centralized API client module in `src/lib/api.ts`. This module will use `axios` and be the single point of contact for all backend communication, including handling CSRF tokens.
    - **Action:** Create a simple placeholder `HomePage.tsx` component.
- **Test:**
  1.  Write a simple component test for `HomePage.tsx` to ensure the Vitest and React Testing Library setup is working correctly.
  2.  Manually start both the backend (`npm run dev:backend`) and frontend (`npm run dev:frontend`) from the project root. Verify that the React app loads in the browser and that a test API call from a component (e.g., to `/api/health`) is successfully proxied to the backend and returns data.
- **Commit:** `feat(ui): P5_T4 initialize react frontend project with vite`

---

#### **Task 5: Build Foundational UI & Authentication Flow**

- **Goal:** To build the core application layout and the complete user authentication and onboarding journey, connecting the UI to the backend APIs.
- **Sub-Task 5.1: Implement App Shell & Routing:**
  - **Action:** Set up `react-router-dom` with routes for the main pages (Home, Dashboard, Agreements, Setup).
  - **Action:** Create a main `Layout.tsx` component that includes a shared header and footer.
  - **Action:** Create a global AuthContext/Provider to manage and share the user's session state throughout the application.

- **Sub-Task 5.2: Build Login & Session Handling:**
  - **Action:** Create a page/component that checks the session status (`GET /api/session`). If logged in, it should redirect to the dashboard. If logged out, it should display a "Sign in with Google" button that correctly links to the `POST /api/auth/signin/google` backend endpoint (after fetching a CSRF token).
- **Sub-Task 5.3: Build Onboarding Pages:**
  - **Action:** Build the "Agreements" page UI.
  - **Action:** Build the "Account Setup" page UI.
  - **Action:** Connect both pages to the `PUT /api/user/settings` endpoint, ensuring the CSRF token is fetched from `GET /api/csrf-token` and sent with the request via the centralized API client.
- **Test:** Write component tests for each new page. Add E2E tests with Playwright to validate the complete login -> agree -> setup -> dashboard flow.
- **Commit:** `feat(ui): P5_T5 implement core layout and authentication flow`

---

#### **Task 6: Build Dashboard & Journal Pages**

- **Goal:** To implement the core data-driven pages of the application.
- **Sub-Task 6.1: Build Dashboard Page:**
  - **Action:** Implement the UI for the Dashboard, including the "Start Journal" card and the "Past weeks" list.
  - **Action:** Fetch and display the list of journals from the `GET /api/journals` endpoint.
  - **Action:** Wire the "Start Journal" button to call `POST /api/journals` and navigate the user to the new journal's loading page.
- **Sub-Task 6.2: Build Journal Loading & View Pages:**
  - **Action:** Create the journal loading page that polls the `GET /api/journals/:id/status` endpoint and displays progress.
  - **Action:** Build the main journal view page with all its components (AGP chart, inputs, etc.) as a read-only view first, fetching data from the `GET /api/journals/:id` endpoint.
- **Sub-Task 6.3: Implement Journal Editing:**
  - **Action:** Add editing and saving functionality to the journal page, connecting the "Save" button to the `PUT /api/journals/:id` endpoint.
- **Test:** Write component tests with Vitest/React Testing Library and E2E tests with Playwright for these pages to ensure data is displayed correctly and user interactions work as expected.
- **Commit:** `feat(ui): P5_T6 implement dashboard and journal view pages`

### **Phase 6: Background Processing Implementation**

**Goal:** Implement the core data processing logic inside the background worker.

1.  **Task: Implement Data Fetching & Analysis**
    - **Action:** In the background worker, implement the logic to fetch data from a user's Nightscout instance (decrypting credentials first).
    - **Action:** Integrate the existing analysis scripts to process the raw data into structured insights and `TimeCluster` objects.
    - **Test:** Write unit tests using Vitest for the data fetching and analysis pipeline, heavily mocking the external Nightscout API.
    - **Commit:** `feat(worker): P6_T1 implement nightscout data fetching and statistical analysis`

2.  **Task: Implement AI & TTS Pipeline**
    - **Action:** Implement the multi-pass Gemini calls to generate the script and description.
    - **Action:** Implement the call to the TTS service to generate the audio file.
    - **Action:** Implement robust error handling for each step of this pipeline.
    - **Test:** Write integration tests using Vitest for this pipeline, mocking the Gemini and TTS APIs to ensure the flow works and that errors are handled gracefully.
    - **Commit:** `feat(worker): P6_T2 implement ai and tts generation pipeline`

3.  **Task: Finalize Job and Update Database**
    - **Action:** Implement the final step in the worker, where all generated artifacts (podcast URL, chart data, etc.) are saved to the `Journal` and `GlycemicEventCluster` tables in the database. The journal `status` should be updated to `COMPLETE`.
    - **Test:** Write a full integration test using Vitest for the background worker that runs through the entire (mocked) process and verifies that the database is updated correctly at the end.
    - **Commit:** `feat(worker): P6_T3 finalize job by saving all generated data`

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
