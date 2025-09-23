# Goodnumbers — Phase 3, Task 2

## TL;DR

Integrate the BullMQ job queue to decouple the long-running journal generation process from the synchronous API request, ensuring the web server remains responsive.

## Invariants (do not change)

- **API Responsiveness:** The `POST /api/journals` endpoint MUST complete its request/response cycle in under 500ms.
- **Job Uniqueness:** Every successful call to `POST /api/journals` that creates a new database record MUST result in exactly one job being enqueued. No duplicate jobs for a single journal creation are permitted.
- **Data Isolation:** All operations MUST remain strictly scoped to the authenticated user. A user cannot enqueue a job for another user's journal.

## Assumptions & Scope

- **Assumption:** The engineer has Docker installed and running on their local development machine.
- **Scope:** This task is strictly limited to setting up the queue, modifying the API endpoint to enqueue a job, and creating a skeleton background worker. The worker's only responsibility is to receive and log the job data. The implementation of the actual data processing logic is explicitly **out of scope**.

## Objectives

1.  Modify the `POST /api/journals` endpoint to create a `Journal` record with a `status` of `PENDING`, enqueue a background job with the new `journalId`, and return immediately.
2.  Implement a skeleton background worker process that connects to Redis, listens for jobs on the `journal-processing` queue, and logs the received `journalId`.
3.  Implement a `pm2` configuration file to manage both the web server and the worker processes for development and production.
4.  Achieve a 100% pass rate on a new integration test suite that verifies the job is correctly enqueued upon journal creation, using a mocked Redis client.
5.  Maintain the existing >95% test coverage and achieve a mutation testing score of >90% for the modified API handler logic.

## Risks & Mitigations

- **Risk:** The connection to the Redis server fails silently, causing jobs to be dropped.
  - **Mitigation:** The queue and worker connection logic will include robust, explicit error handling. The worker process will log connection errors and exit on fatal connection failures to alert the process manager (`pm2`).
- **Risk:** A client-side retry of a failed API request could create a duplicate journal and enqueue a duplicate job.
  - **Mitigation:** For the MVP, this risk is accepted. The primary database constraint on `journalId` prevents data corruption. Future work will introduce an idempotency key to make the endpoint safely retryable.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Decouple the time-intensive journal generation from the user-facing API.
- **Mechanism:** Implement a producer/consumer pattern using a Redis-backed message queue (BullMQ).
  - **Producer:** The Express.js web server (`POST /api/journals`).
  - **Consumer:** A new, separate Node.js background worker process.
- **Trade-offs:**
  - **Pro:** Dramatically improves API responsiveness and perceived performance. Increases system resilience, as failed jobs can be retried independently of the user's session.
  - **Con:** Introduces a new dependency (Redis) and increases architectural complexity (managing a separate worker process).
- **Go/No-Go Decision:** **Go**. This architecture is a non-negotiable requirement for handling long-running, resource-intensive tasks without degrading the user experience.

## Implementation Notes

- **Queue Name:** The BullMQ queue will be named `journal-processing`.
- **Job Payload:** The data payload for each job will be a simple object: `{ "journalId": "cuid-of-the-journal" }`.
- **API Response Contract:** The `POST /api/journals` endpoint's response contract remains unchanged. It will continue to return the newly created `Journal` object, which will now include `status: 'PENDING'`.
- **Configuration:** Redis connection details will be managed by `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_DB` variables in the `.env` files.
- **Process Management:** The background worker and web server will be managed by `pm2` via a version-controlled `ecosystem.config.cjs` file.

## Acceptance Gates

- **Gate 1 (API):** A `POST` request to `/api/journals` by an authenticated user returns a `201 Created` status code. The response body contains the journal object with its `status` field set to `"PENDING"`.
- **Gate 2 (Queue):** Immediately after the API call in Gate 1, a new job containing the correct `journalId` exists in the `journal-processing` queue in Redis.
- **Gate 3 (Worker):** The running background worker process (managed by `pm2`) outputs a log message confirming it has received the job from Gate 2.
- **Gate 4 (Testing):** All existing automated tests must continue to pass. The new mocked integration test for the queueing logic must pass.

## “Make-sure-you” Checklist

- [ ] Run `npm audit` and ensure no new high or critical severity vulnerabilities are introduced by the new dependencies.
- [ ] Confirm that Redis connection credentials are not hardcoded and are loaded exclusively from environment variables.
- [ ] Verify that the `.env.example` file has been updated with placeholders for `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_DB`.
- [ ] Ensure the database transaction for creating the `Journal` record is completed _before_ the job is enqueued. The job should not be added if the database write fails.
- [ ] Confirm the worker process includes graceful shutdown logic to close the Redis connection on `SIGINT` or `SIGTERM`.

## Project hygiene prep

1.  **Create GitHub Issue:** Use the `gh` CLI to create a new issue for this task.
    ```bash
    gh issue create --title "feat(worker): P3_T2 Integrate BullMQ for background job processing" --body "Implement the BullMQ job queue to offload journal generation from the main API thread, as detailed in Phase 3, Task 2 of the implementation plan."
    ```
2.  **Create Branch:** Create your feature branch from the **`phase3develop`** branch, including the issue number.
    ````bash
    git checkout phase3develop
    git pull origin phase3develop
    git checkout -b feat/phase3-task2-background-queue
    ```3.  **Follow Test-Driven Development:** Adhere strictly to the "Red-Green-Refactor" cycle for the implementation, using the commit plan outlined below.
    ````

## In-depth test plan

The primary goal is to verify that the API handler correctly interacts with the queueing system without requiring a live Redis server during the automated test run. This is a **Tier 1: Mocked Integration Test**.

A new test file, `tests/integration/queue.test.ts`, will be created.

1.  **Mocking Strategy:**
    - Use `jest.unstable_mockModule('bullmq', ...)` to provide a fake implementation of the `Queue` class.
    - The mock will replace the `add` method with a `jest.fn()` spy. This allows us to assert that the method was called and inspect the arguments it was called with.

2.  **Test Cases:**
    - **Success Case:**
      - An authenticated user makes a valid `POST` request to `/api/journals`.
      - **Assert:** The mock `Queue.add` function was called exactly one time.
      - **Assert:** The first argument to `Queue.add` was the job name, `'process-journal'`.
      - **Assert:** The second argument was an object `{ journalId: <the_new_journal_id> }`.
    - **Failure Case (Metamorphic Property):**
      - An unauthenticated user makes a `POST` request to `/api/journals`.
      - **Assert:** The request fails with a `401 Unauthorized`.
      - **Assert:** The mock `Queue.add` function was **not** called. This proves that a failed request does not trigger a background job.
    - **Property-Based Test:**
      - Use `fast-check` to generate arbitrary (but valid) user details.
      - For each generated user, create them in the database, make the API call, and verify that `Queue.add` is called with a `journalId` that matches the ID of the journal created in the database for that user. This ensures the link between the created resource and the enqueued job is always correct.

## In-depth engineering plan

### Commit 1: RED — Write Failing Tests for the New Queuing Logic

This commit establishes our goal: the API must enqueue a job and the journal status must be `PENDING`.

1.  **Action: Update Journal Test Expectations**
    - Modify `tests/integration/journals.test.ts`. The test case that asserts a `201 Created` response should now also assert that `res.body.journal.status` is equal to `'PENDING'`. This test will fail initially.

2.  **Action: Create the Mocked Queue Integration Test**
    - Create a new file for our mocked integration test.

    ```typescript
    // file: tests/integration/queue.test.ts

    import session from "supertest-session";
    import * as http from "http";
    import { PrismaClient, User } from "@prisma/client";
    import type { Express } from "express";
    import { jest } from "@jest/globals";

    // 1. Mock BullMQ's NAMED export 'Queue' before any other imports
    const mockQueueAdd = jest.fn();
    jest.unstable_mockModule("bullmq", () => ({
      Queue: jest.fn().mockImplementation(() => ({
        add: mockQueueAdd,
        close: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    // 2. Now import the app factory
    const { createApp } = await import("../../src/index");

    const prisma = new PrismaClient();

    let app: Express;
    let server: http.Server;
    let agent: session.Session;
    let user1: User;
    let csrfToken: string;

    describe("POST /api/journals Job Queuing", () => {
      beforeEach(async () => {
        mockQueueAdd.mockClear();
        app = createApp();
        await new Promise<void>((resolve) => {
          server = app.listen(0, async () => {
            agent = session(app);
            await prisma.user.deleteMany();
            user1 = await prisma.user.create({
              data: {
                email: `user-queue-${Date.now()}@test.com`,
                agreementsSigned: true,
                nightscoutUrl: "https://user1.ns.com",
              },
            });
            const csrfRes = await agent.get("/api/csrf-token");
            csrfToken = csrfRes.body.csrfToken;
            resolve();
          });
        });
      });

      afterEach((done) => {
        server.close(done);
      });

      it("should add a job to the queue with the correct journalId upon successful journal creation", async () => {
        const res = await agent
          .post("/api/journals")
          .set("x-test-user-id", user1.id)
          .send({ _csrf: csrfToken });

        expect(res.status).toBe(201);
        const journalId = res.body.journal.id;

        // Assert that our mock was called correctly
        expect(mockQueueAdd).toHaveBeenCalledTimes(1);
        expect(mockQueueAdd).toHaveBeenCalledWith("process-journal", {
          journalId: journalId,
        });
      });
    });
    ```

3.  **Action: Verify Failure and Commit**
    - Run the tests. The `journals.test.ts` will fail on the status check, and `queue.test.ts` will fail because `mockQueueAdd` was not called. This is the expected "RED" state.

    ```bash
    cd goodnumbers
    npm test
    git add .
    git commit -m "test(api): add failing tests for job queuing on journal creation"
    ```

### Commit 2: GREEN — Implement Job Queue and Skeleton Worker

This commit introduces the necessary code to make the failing tests pass.

1.  **Action: Install and Run Redis via Docker**
    - In your terminal, run the following command to start a Redis container. This will download the image if you don't have it, name the container `goodnumbers-redis`, and expose it on the standard port `6379`.

    ```bash
    docker run -d --name goodnumbers-redis -p 6379:6379 redis/redis-stack-server:latest
    ```

    - **Verify the connection:** After the container starts, test that it's running correctly by pinging it.

    ```bash
    docker exec goodnumbers-redis redis-cli ping
    # You should see the output: PONG
    ```

    - **Management Commands (for reference):**
      - To stop the container: `docker stop goodnumbers-redis`
      - To start it again later: `docker start goodnumbers-redis`

2.  **Action: Install Dependencies**

    ```bash
    cd goodnumbers
    npm install bullmq ioredis
    npm install --save-dev pm2
    ```

3.  **Action: Update Environment Configuration**
    - Update your environment files to use the new Redis variables.

    ```bash
    # file: .env.test

    # ... existing variables

    # Redis connection for testing
    REDIS_HOST=localhost
    REDIS_PORT=6379
    REDIS_PASSWORD=
    REDIS_DB=1 # Use a separate DB for test isolation
    ```

    ```bash
    # file: .env.example

    # ... existing variables

    # --- Background Job Queue (Redis) ---
    # Connection details for the Redis server backing the job queue
    REDIS_HOST=localhost
    REDIS_PORT=6379
    REDIS_PASSWORD=
    REDIS_DB=0
    ```

4.  **Action: Create the Queue Singleton**
    - Create a reusable module to manage the queue connection, reading the new variables.

    ```typescript
    // file: src/lib/queue.ts

    import { Queue } from "bullmq"; // Correctly use named import
    import IORedis from "ioredis";

    // --- Fatal Error Checks ---
    if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
      throw new Error("FATAL: Redis connection variables are not set.");
    }

    const connection = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0", 10),
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    export const journalProcessingQueue = new Queue("journal-processing", {
      connection,
    });

    const closeConnection = async () => {
      await journalProcessingQueue.close();
      connection.disconnect();
    };

    process.on("SIGTERM", closeConnection);
    process.on("SIGINT", closeConnection);
    ```

5.  **Action: Modify the Journal Creation Endpoint**
    - Update the route handler to use the new queue and set the `PENDING` status.

    ```typescript
    // file: src/routes/journal.ts

    import { Router } from "express";
    import { prisma } from "../lib/prisma.ts";
    import { journalProcessingQueue } from "../lib/queue.ts";

    const router = Router();

    router.post("/", async (req, res, next) => {
      const userId = req.user!.id;

      try {
        // 1. Create the journal with a PENDING status
        const journal = await prisma.journal.create({
          data: {
            userId,
            status: "PENDING", // Explicitly set status
          },
        });

        // 2. Enqueue the job for background processing
        await journalProcessingQueue.add("process-journal", {
          journalId: journal.id,
        });

        // 3. Return the created journal object immediately
        res.status(201).json({ journal });
      } catch (error) {
        console.error(
          `[API] Failed to create or enqueue journal for user ${userId}:`,
          error
        );
        next(error); // Pass error to global handler
      }
    });

    export default router;
    ```

6.  **Action: Create the Skeleton Worker**
    - Create the new worker file, ensuring it uses the new environment variables for its connection.

    ```typescript
    // file: src/worker.ts

    import "./lib/env.ts"; // Ensure environment variables are loaded
    import { Worker } from "bullmq";
    import IORedis from "ioredis";

    console.log("[Worker] Starting up...");

    // --- Fatal Error Checks ---
    if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
      throw new Error(
        "FATAL: Redis connection variables are not set for worker."
      );
    }

    const connection = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0", 10),
      maxRetriesPerRequest: null,
    });

    const worker = new Worker(
      "journal-processing",
      async (job) => {
        console.log(
          `[Worker] Processing job ${job.id} for journal: ${job.data.journalId}`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log(`[Worker] Finished job ${job.id}`);
        return { status: "done", journalId: job.data.journalId };
      },
      { connection }
    );

    worker.on("completed", (job) => {
      console.log(`[Worker] Job ${job.id} has completed!`);
    });

    worker.on("failed", (job, err) => {
      console.error(
        `[Worker] Job ${job?.id} has failed with error: ${err.message}`
      );
    });

    const closeGracefully = async () => {
      console.log("[Worker] Shutting down...");
      await worker.close();
      connection.disconnect();
      process.exit(0);
    };

    process.on("SIGTERM", closeGracefully);
    process.on("SIGINT", closeGracefully);

    console.log(
      '[Worker] Worker listening for jobs on "journal-processing" queue...'
    );
    ```

7.  **Action: Create PM2 Ecosystem Configuration**
    - Create a file named `ecosystem.config.cjs` in the `goodnumbers/` root. This file tells `pm2` how to run and manage both our web server and our new worker.
    - **Note:** We use `cluster` mode for the web server to allow it to scale across multiple CPU cores. We use `fork` mode for the worker because it's a single, stateful process that should not be duplicated.

    ```javascript
    // file: ecosystem.config.cjs

    module.exports = {
      apps: [
        {
          name: "goodnumbers-web",
          script: "./dist/index.js",
          instances: 1,
          exec_mode: "cluster",
          watch: ["./dist"],
          env: {
            NODE_ENV: "development",
          },
          env_production: {
            NODE_ENV: "production",
          },
        },
        {
          name: "goodnumbers-worker",
          script: "./dist/worker.js",
          instances: 1,
          exec_mode: "fork",
          watch: ["./dist"],
          env: {
            NODE_ENV: "development",
          },
          env_production: {
            NODE_ENV: "production",
          },
        },
      ],
    };
    ```

8.  **Action: Add/Update Scripts in `package.json`**
    - Update `package.json` with scripts to run the application using `pm2`.

    ```json
    // file: package.json
    {
      "name": "goodnumbers",
      "version": "1.0.0",
      "description": "",
      "main": "index.js",
      "scripts": {
        "start": "pm2 start ecosystem.config.cjs --env production",
        "stop": "pm2 stop ecosystem.config.cjs",
        "dev": "pm2 start ecosystem.config.cjs --watch",
        "logs": "pm2 logs",
        "build": "tsc",
        "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --runInBand",
        "lint": "eslint . --ext .ts",
        "prettier": "prettier --write ."
      },
      "keywords": [],
      "author": "",
      "license": "ISC",
      "type": "module",
      "dependencies": {
        "@auth/express": "^0.11.0",
        "@auth/prisma-adapter": "^2.10.0",
        "@prisma/client": "^6.14.0",
        "body-parser": "^1.20.2",
        "bullmq": "^5.8.2",
        "cookie-parser": "^1.4.6",
        "dotenv": "^17.2.1",
        "express": "^5.1.0",
        "express-rate-limit": "^8.0.1",
        "helmet": "^8.1.0",
        "ioredis": "^5.4.1",
        "prisma": "^6.14.0",
        "tiny-csrf": "^1.1.4",
        "zod": "^4.1.8"
      },
      "devDependencies": {
        // ... (dependencies from previous steps)
        "pm2": "^5.4.0"
      }
    }
    ```

9.  **Action: Update Project Documentation**
    - Add instructions for the new dependencies to the main project `README.md`.

    ````markdown
    # file: README.md

    ## Local Development Setup

    ### Prerequisites

    1.  **Node.js** (v18 or later)
    2.  **Docker**

    ### Running the Application

    1.  **Install Dependencies:**

        ```bash
        npm install
        ```

    2.  **Setup Environment Variables:**
        Copy the `.env.example` file to `.env` and fill in the required values.

        ```bash
        cp .env.example .env
        ```

    3.  **Run Redis:**
        Start the Redis container using Docker.

        ```bash
        docker run -d --name goodnumbers-redis -p 6379:6379 redis/redis-stack-server:latest
        ```

    4.  **Run Database Migrations:**

        ```bash
        npx prisma migrate dev
        ```

    5.  **Build and Run with PM2:**
        First, compile the TypeScript code. Then, start the web server and the background worker using `pm2`.

        ```bash
        npm run build
        npm run dev
        ```

    6.  **View Logs:**
        To see the combined output from both the web server and the worker, run:
        ```bash
        npm run logs
        ```

    ### Stopping the Application

    To stop the `pm2` processes:

    ```bash
    npm run stop
    ```
    ````

    To stop the Redis container:

    ```bash
    docker stop goodnumbers-redis
    ```

    ```

    ```

10. **Action: Verify Success and Commit**
    - First, build the code: `npm run build`.
    - Run the automated tests. All tests should now pass. This is our "GREEN" state.

    ````bash
    cd goodnumbers
    npm test
    ```    *   Manually test the full flow:
        1.  Run `npm run dev` in one terminal.
        2.  Run `npm run logs` in another terminal to watch the output.
        3.  Trigger the `POST /api/journals` endpoint.
        4.  Observe the logs to confirm the API returns quickly and the worker log (`[Worker] Processing job...`) appears.
    *   Finally, commit the work.

    ```bash
    git add .
    git commit -m "feat(worker): P3_T2 integrate bullmq for background job processing"
    ````
