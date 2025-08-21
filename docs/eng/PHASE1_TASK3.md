# goodnumbers-workspace/docs/eng/PHASE1_TASK3.md

# Phase 1, Task 3: Create Basic Express Server

**Author:** Gemini
**Date:** 2025-08-16
**Status:** Complete

## 1. Overview & Goal

This document provides a step-by-step guide for a junior engineer to implement the foundational Express.js web server for the Goodnumbers project. This is the first step in building the backend API.

The primary goal of this task is to create a minimal, runnable Express server that exposes a single public `/health` endpoint. This endpoint will be used in the future for monitoring and to confirm the server is operational. The entire process will follow the Test-Driven Development (TDD) methodology outlined in the project's implementation plan.

**Deliverable:** A running Express server with a `/health` endpoint that returns `{"status": "ok"}`, verified by an integration test.

## 2. Pre-requisites

- Ensure you are working inside the `goodnumbers` project directory: `cd /home/ssuppe/vscode/goodnumbers-workspace/goodnumbers`.
- All work from **Phase 1, Task 1 (Project Setup)** and **Phase 1, Task 2 (Database Schema)** must be complete and merged into the `develop` branch.
- Your local `develop` branch must be up-to-date with the remote repository.

## 3. Development Process Checklist

This task must adhere to the `DEVELOPMENT_PROCESS.md`.

- [x] Create a GitHub Issue to track this task.
- [x] Create a feature branch from `develop` named `feat/1-basic-express-server`.
- [x] Follow the Red-Green-Refactor cycle for implementation.
- [x] Run all quality checks (lint, type check, tests) before committing.
- [x] Create a Pull Request targeting the `develop` branch.

---

## 4. Step-by-Step Implementation Guide

### Step 1: Branching and Dependency Installation

First, prepare your local environment.

1.  **Sync your `develop` branch:**

    ```bash
    git checkout develop
    git pull origin develop
    ```

2.  **Create your feature branch:** The name follows the convention `type/issue-short-description`.

    ```bash
    git checkout -b feat/1-basic-express-server
    ```

3.  **Install Dependencies:** Install `express` and its corresponding TypeScript types. `supertest` types are also needed for our tests.
    ```bash
    npm install express
    npm install --save-dev @types/express @types/supertest
    ```

### Step 2: Write the Failing Test (The "Red" Step)

We start by writing a test for the functionality that does not yet exist. This test will fail, which is the expected outcome.

1.  **Create the test file:**
    Create a new file at `/home/ssuppe/vscode/goodnumbers-workspace/goodnumbers/tests/integration/server.test.ts`.

2.  **Write the integration test:**
    Add the following code to the `server.test.ts` file. This test uses `supertest` to start the (not-yet-existing) server and make a request to the `/health` endpoint.

    ```typescript
    import request from "supertest";
    import { app } from "../../src/index"; // We will export 'app' from our server file
    import http from "http";

    // We need a way to close the server after tests are done
    let server: http.Server;

    beforeAll((done) => {
      // Let's use a random port for testing to avoid conflicts
      server = app.listen(0, () => {
        done();
      });
    });

    afterAll((done) => {
      server.close(done);
    });

    describe("GET /health", () => {
      it("should return 200 OK with a status message", async () => {
        const response = await request(server).get("/health");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
      });
    });
    ```

    _Note: This code will have type errors because `src/index.ts` does not yet export an `app` object._

3.  **Confirm the test fails:**
    Run the test suite. It will fail because we haven't implemented the server.
    ```bash
    npm test
    ```
    You should see an error indicating that the test has failed. This is our "Red" state.

### Step 3: Implement the Express Server (The "Green" Step)

Now, write the minimum amount of code required to make the failing test pass.

1.  **Create/Update the server file:**
    Open the file at `/home/ssuppe/vscode/goodnumbers-workspace/goodnumbers/src/index.ts` and add the following code.

    ```typescript
    import express from "express";

    const app = express();
    const PORT = process.env.PORT || 3000;

    // Middleware to parse JSON bodies
    app.use(express.json());

    // Define the /health endpoint
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok" });
    });

    // Only start listening if the file is run directly (and not in a test environment)
    if (process.env.NODE_ENV !== "test") {
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      });
    }

    // Export the app for testing purposes
    export default app;
    ```

2.  **Confirm the test passes:**
    Run the test suite again.
    ```bash
    npm test
    ```
    This time, the test should pass. This is our "Green" state.

### Step 4: Refactor and Finalize

With a passing test, we can now clean up our code and add conveniences for development.

1.  **Add `package.json` scripts:**
    Open `/home/ssuppe/vscode/goodnumbers-workspace/goodnumbers/package.json` and add the following scripts to the `scripts` object. This will make it easier to build, start, and develop the server.

    ```json
    "scripts": {
      "build": "tsc",
      "start": "node dist/index.js",
      "dev": "nodemon src/index.ts",
      "test": "NODE_OPTIONS=\\\"--experimental-vm-modules\\\" jest"
    },
    ```

    _Note: `nodemon.json` already exists, so the `dev` script will use it automatically._

2.  **Build the project:**
    Run the build script to compile the TypeScript code into JavaScript in the `dist` directory (as configured in `tsconfig.json`).

    ```bash
    npm run build
    ```

3.  **Manually test the server (Optional):**
    You can start the server to confirm it runs correctly.
    ```bash
    npm start
    ```
    You should see "Server is running on http://localhost:3000". You can visit `http://localhost:3000/health` in your browser or with `curl` to see the response. Press `Ctrl+C` to stop the server.

### Step 5: Security Hardening (Recommended)

Even for a simple server, it's crucial to implement foundational security measures from the start.

1.  **Install Security Dependencies:**
    Install `helmet` to secure HTTP headers and `express-rate-limit` for protection against brute-force or DoS attacks.

    ```bash
    npm install helmet express-rate-limit
    ```

2.  **Update Server Implementation:**
    Modify `/home/ssuppe/vscode/goodnumbers-workspace/goodnumbers/src/index.ts` to include these security middlewares. They should be applied before your routes.

    ```typescript
    import express from "express";
    import helmet from "helmet";
    import rateLimit from "express-rate-limit";

    const app = express();
    const PORT = process.env.PORT || 3000;

    // --- Security Middlewares ---

    // Set various security HTTP headers
    app.use(helmet());

    // Basic rate limiting to prevent brute-force attacks
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
    app.use(limiter);

    // --- Core Middlewares ---
    app.use(express.json());

    // --- Routes ---
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok" });
    });

    // --- Server Startup ---
    if (process.env.NODE_ENV !== "test") {
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      });
    }

    export default app;
    ```

3.  **Run Dependency Security Audit:**
    After installing new packages, always check for known vulnerabilities.
    ```bash
    npm audit
    ```
    If `npm audit` reports vulnerabilities, follow its instructions to fix them (e.g., `npm audit fix`).

### Step 6: Quality Checks and Commit

Before committing, ensure the code meets all project quality standards.

1.  **Run all checks:**

    ```bash
    # Run linter (assuming eslint is configured)
    npx eslint . --ext .ts

    # Run type checking
    npm run build

    # Run tests (they should still pass with the new middleware)
    npm test
    ```

    All checks must pass before you proceed.

2.  **Commit the changes:**
    Stage your changes and create a commit using the Conventional Commits format. The commit message should reflect the added security measures.
    ```bash
    git add .
    git commit -m "feat(server): add basic express server with health check and security hardening"
    ```

### Step 7: Create a Pull Request

Finally, push your code and open a Pull Request for review.

1.  **Push your branch to the remote repository:**

    ```bash
    git push origin feat/1-basic-express-server
    ```

2.  **Create the Pull Request:**
    Use the `gh` CLI to create the PR, targeting the `develop` branch.

    ```bash
    gh pr create --base develop --title "feat(server): add basic express server with health check and security hardening" --body-file -
    ```

    When prompted for the body, paste the following template and fill it out.

    ```markdown
    Closes #<issue-number>

    ## Summary

    This PR establishes the initial Express.js server as per Phase 1, Task 3. It includes:

    - A basic Express application setup in `src/index.ts`.
    - A public `/health` endpoint that returns a 200 OK status.
    - An integration test using `supertest` to verify the `/health` endpoint.
    - `build`, `start`, and `dev` scripts in `package.json` for running the server.
    - **Security:** Adds `helmet` for secure HTTP headers and `express-rate-limit` for basic DoS protection.

    ## How to Test

    1. Check out this branch: `git checkout feat/1-basic-express-server`
    2. Install dependencies: `npm install`
    3. Run `npm audit` to check for vulnerabilities.
    4. Run the tests: `npm test`. All tests should pass.
    5. Build the project: `npm run build`. It should compile without errors.
    6. Start the server: `npm start`.
    7. In a separate terminal, send a request to the health endpoint: `curl http://localhost:3000/health`.
    8. The response should be: `{"status":"ok"}`.
    ```

You have now completed Phase 1, Task 3.
