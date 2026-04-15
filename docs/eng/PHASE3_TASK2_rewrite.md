Of course. After our detailed discussion and iterative debugging, we've arrived at a robust, modern, and reliable plan. This final version incorporates the correct testing pattern (`jest.unstable_mockModule`) and follows a clear TDD process for both the API and the worker logic.

Here is the complete, final version of the `PHASE3_TASK2_rewrite.md` document for you to copy and paste.

---

# Goodnumbers — PHASE 3, TASK 2: Implement Asynchronous Job Queue

**Version:** 6.0 (Final, with Modern Mocking Patterns)
**Author:** Technical Lead
**Date:** 2025-10-03
**Status:** Approved for Implementation

## 1. Overview & Purpose (The "Why")

Welcome to a foundational task for the Goodnumbers application. The journal generation process is a heavy operation, involving external API calls, data analysis, and AI processing. If we were to run this process directly within an API request, it would take far too long, leading to request timeouts for the user and making our server unresponsive. This creates a poor user experience and a fragile system.

To solve this, we are implementing an **asynchronous job queue**. This is a standard and powerful architectural pattern that decouples the initial, quick user request from the slow, intensive background work.

Here’s how it works:

1.  **The API (Producer):** The user's request to create a journal hits our API. The API's _only_ job is to create a placeholder record in the database with a `PENDING` status and then place a "job" onto a queue. It then immediately responds to the user with a `201 Created` status. This entire process is extremely fast.
2.  **The Queue (Message Broker):** We will use Redis as a high-speed message broker that holds these jobs.
3.  **The Worker (Consumer):** We will run a completely separate, standalone Node.js process. Its only job is to watch the queue for new jobs. When it sees one, it picks it up and performs all the heavy lifting (fetching data, calling AI, etc.).

This document is the complete, definitive guide to implementing this system correctly, including the robust and reliable testing patterns required to ensure it is maintainable.

## 2. Our Testing Strategy: A Two-Tier Approach

For a feature like this that interacts with an external service (Redis), a mature testing strategy involves two tiers. It is critical to understand the purpose of each.

- **Tier 1: Mocked Integration Tests (Fast Feedback)**
  - **Goal:** To verify our application's internal logic _without_ touching the real external service. For this task, it answers the question: "Does my API endpoint correctly call the `queue.add()` function when it's supposed to?"
  - **Method:** We use Jest's `unstable_mockModule` capability to replace the `bullmq` library with a lightweight, in-memory fake version that we control.
  - **Benefits:** These tests are extremely fast, 100% reliable, and require zero external dependencies (no Docker needed). They are perfect for running constantly during local development.

- **Tier 2: "True" Integration Tests (High Confidence)**
  - **Goal:** To verify that our application can correctly connect to, serialize data for, and interact with the _real_ external service.
  - **Method:** These tests require a live Redis server.
  - **Benefits:** They provide the highest level of confidence that the entire system works end-to-end. However, they are slower and can sometimes be brittle.

**Our Plan for This Task:** We will implement a robust **Tier 1** test to guarantee our application logic is correct and keep our local development fast. The `Justfile` commands will be preserved as a blueprint for a **Tier 2** test that we can run in our automated Continuous Integration (CI) pipeline in the future.

## 3. Developer Environment & Workflow

To make running our multi-process application and its dependencies trivial, we will use Docker Compose and a `Justfile`.

```makefile
# file: goodnumbers/justfile

# --- SERVICE MANAGEMENT (for Development) ---
services-up:
    @echo "Starting Redis container for development..."
    @docker-compose up -d

services-down:
    @echo "Stopping and removing development Redis container..."
    @docker-compose down

# --- APPLICATION MANAGEMENT (for Development) ---
build:
    @npm run build

dev:
    @npm run dev

stop:
    @npm run stop

logs:
    @npm run logs

# --- COMBINED WORKFLOWS (for Development) ---
run: build services-up dev

# --- UTILITIES ---
clean: stop services-down
    @echo "Removing node_modules..."
    @rm -rf node_modules

# =============================================================
# === TESTING WORKFLOWS =======================================
# =============================================================

# Starts the Redis service required for a "Tier 2" integration test.
test-env-up:
    @echo "Starting Redis container for testing..."
    @docker-compose up -d redis

# Stops the Redis service used for testing.
test-env-down:
    @echo "Stopping Redis container for testing..."
    @docker-compose down

# Runs the entire test suite.
test:
    @echo "Running the test suite..."
    @npm test

# The all-in-one command for a "Tier 2" CI-style test run.
test-ci:
    @echo "Running CI test cycle: Starting services -> Running tests -> Tearing down..."
    @just test-env-up
    @npm test
    @just test-env-down
```

> **A Note on `npm test` vs. `just test-ci`**
>
> Because we are using a **mocked** test for local development, you will **only need to run `npm test`** for this task. It is fast and does **not** require Docker to be running.
>
> The `test-ci` command, which starts Redis, is what we would use in an automated CI pipeline to run a "Tier 2" test against the real thing. We preserve it for that future purpose.

---

## 4. The Implementation Plan

This plan is broken into two main parts. Part 1 focuses on the API and ensuring jobs get placed on the queue correctly. Part 2 focuses on the worker and ensuring it processes those jobs correctly.

### **Part 1: Implementing the API and Job Enqueueing**

We will follow the "Red-Green-Refactor" TDD workflow.

#### Commit 1: RED — Write Failing Tests to Define Our API's Goal

This commit establishes our precise requirements through tests. The tests will fail initially because the implementation does not yet exist.

##### **Action 1: Update Existing Journal Test Expectations**

Modify `tests/integration/journals.test.ts`. The main success test must now assert that the created journal's `status` is `'PENDING'`.

```typescript
// file: tests/integration/journals.test.ts
// ... (imports and beforeEach/afterEach remain the same)

describe("POST /api/journals", () => {
  // ... (beforeEach, afterEach, afterAll setup)

  // ... (401 and 403 tests remain the same)

  it("should return 201 Created and status PENDING for a valid request", async () => {
    const res = await agent
      .post("/api/journals")
      .set("x-test-user-id", user1.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);
    // THIS IS THE NEW ASSERTION: We verify the initial state is PENDING.
    expect(res.body.journal.status).toBe("PENDING");
  });
});
```

##### **Action 2: Delete the Old Mock File**

Our new mocking pattern does not use the `__mocks__` directory, which will keep our project cleaner.

```bash
rm -f tests/__mocks__/bullmq.ts
```

##### **Action 3: Create the Mocked Integration Test**

This test uses the modern `jest.unstable_mockModule` pattern. It gives us explicit control over when the mock is registered and when the application code is loaded, guaranteeing reliability.

Create a new file at `tests/integration/queue.test.ts`.

```typescript
// file: tests/integration/queue.test.ts

import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { PrismaClient, User } from "@prisma/client";
import session from "supertest-session";
import * as http from "http";
import type { Express } from "express";

// --- This is the key to the new, reliable pattern ---

// We will store the mock instance here, in a scope accessible to the entire test suite.
let mockQueueInstance: any;

// 1. Define the mock implementation for the Queue class.
const MockQueue = jest.fn().mockImplementation((_queueName) => {
  const instance = {
    name: _queueName,
    add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
    obliterate: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getJobs: jest.fn().mockResolvedValue([]), // Default to empty array
  };
  // When a new instance is created, we capture it in our shared variable.
  mockQueueInstance = instance;
  return instance;
});

// 2. Register the mock using the modern API. This tells Jest: "When you see an
//    import for 'bullmq', provide this mock object instead."
jest.unstable_mockModule("bullmq", () => ({
  Queue: MockQueue,
}));

// 3. NOW, we can dynamically import the application code. This guarantees that
//    it gets our mocked version of BullMQ when it loads.
const { createApp } = await import("../../src/index.js");

// --- End of the new pattern ---

const prisma = new PrismaClient();
let app: Express;
let server: http.Server;
let agent: session.Session;
let testUser: User;
let csrfToken: string;

describe("API to Mock Job Queue Integration", () => {
  beforeAll(async () => {
    // By the time this runs, `createApp` is available and the mock is in place.
    // The `new Queue()` call inside the app's import chain will have already
    // been captured and stored in our `mockQueueInstance` variable.
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    agent = session(app);

    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: {
        email: `final-queue-test-${Date.now()}@example.com`,
        agreementsSigned: true,
        nightscoutUrl: "https://final-queue.ns.com",
      },
    });

    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    // Clear mock history before each test for isolation.
    mockQueueInstance.add.mockClear();
  });

  it("POST /api/journals should create a journal and add a job to the mock queue", async () => {
    // Assert Pre-condition: Make sure we have our mock instance before we act.
    expect(mockQueueInstance).toBeDefined();

    // Act: Call the API endpoint.
    const response = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(201);
    const journalId = response.body.journal.id;

    // Assert: Check that our application code called the mock instance's `add` method correctly.
    expect(mockQueueInstance.add).toHaveBeenCalledWith("process-journal", {
      journalId: journalId,
    });
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
  });
});
```

##### **Action 4: Verify Failure and Commit**

Run the tests. They will fail as expected because the `PENDING` status and queueing logic haven't been implemented. This is our "RED" state.

```bash
# Docker is NOT required for this test.
npm test

# Commit the failing tests
git add .
git commit -m "test(api): add failing tests for job queuing on journal creation"
```

---

#### Commit 2: GREEN — Implement the Feature and Make API Tests Pass

This commit introduces all the necessary code to implement the job queue system.

##### **Action 1: Define Services with Docker Compose**

Create `docker-compose.yml`.

```yaml
# file: goodnumbers/docker-compose.yml
version: "3.8"
services:
  redis:
    image: redis/redis-stack-server:latest
    container_name: goodnumbers-redis
    command: redis-stack-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
volumes:
  redis-data:
    driver: local
```

##### **Action 2: Install Dependencies**

```bash
cd goodnumbers
npm install bullmq ioredis
npm install --save-dev pm2
```

##### **Action 3: Update Environment Configuration**

Add Redis settings to `.env.example` and `.env.test`.

```bash
# file: goodnumbers/.env.example
# ... existing variables ...
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=a-very-secure-and-long-password-for-local-dev
REDIS_DB=0
QUEUE_NAME=journal-processing
```

```bash
# file: goodnumbers/.env.test
# ... existing variables
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=a-very-secure-and-long-password-for-local-dev
REDIS_DB=1 # Use a separate DB for test isolation
QUEUE_NAME=journal-processing-test
```

##### **Action 4: Create the Queue Singleton Module**

```typescript
// file: src/lib/queue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT!, 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || "journal-processing";

export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, {
  connection,
});
```

##### **Action 5: Modify the Journal Creation Endpoint**

Update `src/routes/journal.ts` to add jobs to the queue and include the robust rollback logic.

```typescript
// file: src/routes/journal.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { journalQueue } from "../lib/queue.js"; // Import the queue

const router = Router();

router.post("/", async (req, res, next) => {
  const userId = req.user!.id;
  let journal;

  try {
    // 1. Create the journal with PENDING status.
    journal = await prisma.journal.create({
      data: { userId, status: "PENDING" },
    });

    // 2. Enqueue the job for the worker.
    await journalQueue.add("process-journal", { journalId: journal.id });

    res.status(201).json({ journal });
  } catch (error) {
    // 3. CRITICAL ROLLBACK LOGIC: If enqueueing fails, delete the orphaned journal.
    if (journal) {
      console.error(
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back.`
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }
    next(error);
  }
});

export default router;
```

##### **Action 6: Create the Skeleton Worker**

```typescript
// file: src/worker.ts
import "./lib/env.js";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { JOURNAL_QUEUE_NAME } from "./lib/queue.js";

console.log("[Worker] Starting up...");
const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT!, 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  JOURNAL_QUEUE_NAME,
  async (job) => {
    console.log(
      `[Worker] Processing job ${job.id} (Journal ID: ${job.data.journalId})`
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`[Worker] Finished job ${job.id}`);
    return { status: "done" };
  },
  { connection }
);

worker.on("completed", (job) =>
  console.log(`[Worker] Job ${job.id} has completed.`)
);
worker.on("failed", (job, err) =>
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`)
);

const closeGracefully = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGTERM", closeGracefully);
process.on("SIGINT", closeGracefully);

console.log(`[Worker] Listening for jobs on "${JOURNAL_QUEUE_NAME}"...`);
```

##### **Action 7: Create PM2 Ecosystem Configuration**

This file tells the PM2 process manager how to run our applications. We will configure it to use the more stable `fork` mode and explicitly disable its built-in watcher, as `nodemon` will be handling that for us in development.

````javascript
// file: goodnumbers/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'goodnumbers-web',
      script: './dist/server.js', // CORRECTED: Point to the new server entry point
      exec_mode: 'fork',
      watch: false, // CRITICAL: Disable PM2's watcher
      ignore_watch: ['node_modules', 'prisma'],
      restart_delay: 5000,
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'goodnumbers-worker',
      script: './dist/worker.js',
      exec_mode: 'fork',
      watch: false, // CRITICAL: Disable PM2's watcher
      ignore_watch: ['node_modules', 'prisma'],
      restart_delay: 5000,
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};```

##### **Action 8: Add/Update Scripts in `package.json`**

```json
// file: goodnumbers/package.json
{
  // ...
  "scripts": {
    "start": "pm2 start ecosystem.config.cjs --env production",
    "stop": "pm2 stop ecosystem.config.cjs && pm2 delete ecosystem.config.cjs",
    "dev": "nodemon --watch src --ext ts --exec \"npm run build && pm2 startOrReload ecosystem.config.cjs --env development\"",
    "logs": "pm2 logs",
    "build": "tsc",
    "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --runInBand",
    "lint": "eslint . --ext .ts",
    "prettier": "prettier --write ."
  }
  // ...
}
````

##### **Action 9: Verify Success and Commit**

1.  **Run automated tests.** All tests should now pass. This is our "GREEN" state.
    ```bash
    npm test
    ```
2.  **Manually test the full flow:**
    1.  Run `just run` in one terminal.
    2.  Run `just logs` in another.
    3.  Trigger the `POST /api/journals` endpoint.
    4.  Observe the logs to confirm the API responds instantly and the worker log appears shortly after.
3.  **Commit the work.**
    ```bash
    git add .
    git commit -m "feat(worker): integrate bullmq for background job processing"
    ```

---

### **Part 2: Unit Testing the Worker**

Now that the API correctly enqueues jobs, we must test the worker's logic in isolation.

#### Commit 3: RED — Write a Failing Unit Test for the Worker

Our goal is to test the job processing logic without a real queue or database. This test will fail initially because the logic isn't exported from the worker file for testing.

Create a new file at `tests/unit/worker.test.ts`.

```typescript
// file: tests/unit/worker.test.ts
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { prisma } from "../../src/lib/prisma.js";
import { processJournalJob } from "../../src/worker.js"; // This import will fail

// Mock the Prisma client
jest.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    journal: {
      update: jest.fn(),
    },
  },
}));

describe("Worker Job Processing", () => {
  beforeEach(() => {
    // Clear mock history before each test
    (prisma.journal.update as jest.Mock).mockClear();
  });

  it("should update the journal status to COMPLETE on successful processing", async () => {
    const fakeJob = { data: { journalId: "journal123" } };

    // For now, let's assume success and mock the DB returning a record
    (prisma.journal.update as jest.Mock).mockResolvedValue({});

    // Act: Call the function we want to test
    await processJournalJob(fakeJob as any); // Use `as any` to satisfy type checking for the mock

    // Assert: Check that our logic updated the journal correctly
    expect(prisma.journal.update).toHaveBeenCalledWith({
      where: { id: "journal123" },
      data: {
        status: "COMPLETE",
      },
    });
    expect(prisma.journal.update).toHaveBeenCalledTimes(1);
  });
});
```

Run `npm test`. It will fail. This is our "RED" state. Commit this failing test.

```bash
git add .
git commit -m "test(worker): add failing unit test for job processor"
```

#### Commit 4: GREEN — Implement and Export the Worker Logic

Now, we make the test pass.

##### **Action 1: Refactor `src/worker.ts`**

Modify the worker to export the processing logic and to prevent the worker from starting up in the `test` environment.

```typescript
// file: src/worker.ts
import "./lib/env.js";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { JOURNAL_QUEUE_NAME } from "./lib/queue.js";
import { prisma } from "./lib/prisma.js";

// --- Exported Job Logic for Testability ---
export async function processJournalJob(job: Job) {
  console.log(
    `[Worker] Processing job ${job.id} (Journal ID: ${job.data.journalId})`
  );
  const { journalId } = job.data;

  // This is where all the complex logic will go.
  // For now, we just simulate success.
  await prisma.journal.update({
    where: { id: journalId },
    data: { status: "COMPLETE" },
  });

  console.log(`[Worker] Finished job ${job.id}`);
  return { status: "done" };
}

// --- Worker Setup ---
// This guard prevents the worker from starting during tests.
if (process.env.NODE_ENV !== "test") {
  console.log("[Worker] Starting up...");
  const connection = new IORedis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(JOURNAL_QUEUE_NAME, processJournalJob, {
    connection,
  });

  worker.on("completed", (job) =>
    console.log(`[Worker] Job ${job.id} has completed.`)
  );
  worker.on("failed", (job, err) =>
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`)
  );

  console.log(`[Worker] Listening for jobs on "${JOURNAL_QUEUE_NAME}"...`);
}
```

Run `npm test`. The worker test should now pass. This is our "GREEN" state. Commit this work.

```bash
git add .
git commit -m "feat(worker): implement basic job processing logic"
```

#### Commit 5: REFACTOR — Add a Test for Failure Cases

A robust system must handle errors gracefully.

##### **Action 1: Add a Failing Test for Error Handling**

Add a new `it` block to `tests/unit/worker.test.ts`.

```typescript
// file: tests/unit/worker.test.ts
// ... (at the end of the describe block)

it("should update the journal status to FAILED if an error occurs", async () => {
  const fakeJob = { data: { journalId: "journal456" } };
  const errorMessage = "AI pipeline failed";

  // Arrange: Simulate a failure by having the main logic throw an error.
  // The first mock call represents the attempt to set status to COMPLETE, which fails.
  (prisma.journal.update as jest.Mock)
    .mockRejectedValueOnce(new Error(errorMessage))
    // The second mock call represents the attempt to set status to FAILED, which succeeds.
    .mockResolvedValueOnce({});

  // Act
  await expect(processJournalJob(fakeJob as any)).rejects.toThrow(errorMessage);

  // Assert
  expect(prisma.journal.update).toHaveBeenCalledTimes(2);
  // The second call should be to set the FAILED status
  expect(prisma.journal.update).toHaveBeenLastCalledWith({
    where: { id: "journal456" },
    data: {
      status: "FAILED",
      statusMessage: errorMessage,
    },
  });
});
```

##### **Action 2: Implement Error Handling**

Update `src/worker.ts` to make the new test pass.

```typescript
// file: src/worker.ts
// ...
export async function processJournalJob(job: Job) {
  const { journalId } = job.data;
  console.log(`[Worker] Processing job ${job.id} (Journal ID: ${journalId})`);

  try {
    // This is where all the complex logic will go.
    await prisma.journal.update({
      where: { id: journalId },
      data: { status: "COMPLETE" },
    });
    console.log(`[Worker] Finished job ${job.id}`);
    return { status: "done" };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Worker] Job ${job.id} failed for journal ${journalId}:`,
      errorMessage
    );

    // Update the journal to reflect the failure
    await prisma.journal.update({
      where: { id: journalId },
      data: {
        status: "FAILED",
        statusMessage: errorMessage,
      },
    });
    // Re-throw the error so BullMQ knows the job failed and can handle retries, etc.
    throw error;
  }
}
// ...
```

Run `npm test`. All tests should pass. Commit your final work.

```bash
git add .
git commit -m "refactor(worker): add robust error handling to job processor"
```

## 5. Conclusion

Congratulations. By completing this task, you have implemented one of the most critical and scalable pieces of our backend infrastructure. You have also created a sophisticated, two-tiered testing strategy that balances speed and confidence. You now have a fast, reliable mock-based test for the API and focused, robust unit tests for the worker's business logic. This foundation will serve us well as we continue to build out the application's features.
Of course. This has been a long and arduous debugging journey, but the result is a much deeper understanding of the problem and a truly robust solution. It is critical to capture all of this knowledge in the final plan so that the junior engineer has a clear, correct, and educational path forward.

I have completely rewritten the `PHASE3_TASK2_rewrite.md` document from the ground up. This new version incorporates all of our learnings:

- **The Root Cause:** It starts by explaining the true problem—the `ioredis` library's incompatibility with the Jest ESM environment—and why it was causing all the integration tests to crash.
- **The Global Solution:** It implements the global mock of `ioredis` as the very first step, ensuring a stable test environment _before_ we even begin the TDD cycle.
- **A Cleaner TDD Flow:** With a stable environment, the Red-Green-Refactor steps are now much cleaner, more focused, and free of configuration-related errors.
- **Architectural Best Practices:** It correctly implements the "lazy initialization" pattern for the queue connection, which is a superior application design.
- **Targeted Mocking:** It uses a more targeted and easier-to-understand mocking strategy for the `queue.test.ts` file, now that the global crashes are solved.

This document is the definitive guide. You can copy and paste it in its entirety.

---

# Goodnumbers — PHASE 3, TASK 2: Implement Asynchronous Job Queue

**Version:** 7.0 (Definitive, with Battle-Hardened Testing Strategy)
**Author:** Technical Lead
**Date:** 2025-10-03
**Status:** Approved for Implementation

## 1. Overview & Purpose (The "Why")

Welcome to a foundational task for the Goodnumbers application. The journal generation process is a heavy operation, involving external API calls, data analysis, and AI processing. If we were to run this process directly within an API request, it would take far too long, leading to request timeouts for the user and making our server unresponsive. This creates a poor user experience and a fragile system.

To solve this, we are implementing an **asynchronous job queue**. This is a standard and powerful architectural pattern that decouples the initial, quick user request from the slow, intensive background work.

Here’s how it works:

1.  **The API (Producer):** The user's request to create a journal hits our API. The API's _only_ job is to create a placeholder record in the database with a `PENDING` status and then place a "job" onto a queue. It then immediately responds to the user with a `201 Created` status. This entire process is extremely fast.
2.  **The Queue (Message Broker):** We will use Redis as a high-speed message broker that holds these jobs.
3.  **The Worker (Consumer):** We will run a completely separate, standalone Node.js process. Its only job is to watch the queue for new jobs. When it sees one, it picks it up and performs all the heavy lifting (fetching data, calling AI, etc.).

## 2. The Critical Lesson: Conquering the Test Environment

Before writing a single line of application code, it is essential to understand and solve the core problem we have faced: **`ioredis`, the library used by our queue system, is incompatible with Jest's modern ES Module test environment.**

When any of our integration tests ran `createApp()`, the application would eagerly try to import `bullmq`, which in turn tried to import `ioredis`. This caused a crash deep within `ioredis`'s code (`TypeError: self.auth is not a function`) that had nothing to do with our logic. This is why _all_ of our integration tests were failing, even simple ones.

**The Solution: A Global Mock**

The definitive solution is to tell Jest to **globally replace `ioredis` with a harmless fake** any time a test is running. This mock will satisfy `bullmq` without attempting any real network connections. This is a robust, standard pattern for dealing with problematic dependencies in a test environment.

Our first step will be to implement this global mock to create a stable foundation for the rest of our work.

## 3. The Implementation Plan

This plan is now broken into two parts. Part 1 is a one-time setup to stabilize our entire test suite. Part 2 is the standard Red-Green-Refactor TDD cycle for building the feature.

### **Part 1: Stabilizing the Test Environment (The Foundation)**

This is our "Commit 0". We will fix the test environment before we write our failing feature tests.

#### **Action 1: Create the Global `ioredis` Mock**

Create a new file. It **must** be a CommonJS file (`.cjs`) to be compatible with how `bullmq` loads its dependencies.

```javascript
// file: tests/mocks/ioredis.mock.cjs
"use strict";
const EventEmitter = require("events");

/**
 * A simple, global mock for the ioredis library in CommonJS format.
 * The 'jest' global is automatically provided by the test runner.
 */
class IORedisMock extends EventEmitter {
  constructor(options = {}) {
    super();
    // Emit 'connect' immediately to simulate a successful connection.
    // This is crucial for BullMQ to think it has a valid connection.
    process.nextTick(() => this.emit("connect"));
  }

  disconnect = jest.fn();
}

// This structure handles different module import syntaxes, making it robust.
module.exports = IORedisMock;
module.exports.default = IORedisMock;
```

#### **Action 2: Configure Jest to Use the Mock**

Update the `moduleNameMapper` in the Jest configuration to intercept all calls to `ioredis`.

```javascript
// file: goodnumbers/jest.config.cjs
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: "./tsconfig.json" }],
  },
  moduleNameMapper: {
    /**
     * CRITICAL FIX: This line globally replaces `ioredis` with our harmless
     * mock, solving the test suite crashes.
     */
    "^ioredis$": "<rootDir>/tests/mocks/ioredis.mock.cjs",

    /**
     * This rule is CRITICAL for resolving local module imports in an ESM project.
     */
    "^(\\.{1,2}/.*)\\.js$": "$1",

    "\\.(json)$": "<rootDir>/__mocks__/fileMock.cjs",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
```

#### **Action 3: Verify a Stable Environment and Commit**

Run the full test suite.

```bash
npm test
```

**Expected Outcome:** All existing tests should now **PASS**. The environment is stable. The crashes are gone. Now, and only now, can we begin feature development.

```bash
git add .
git commit -m "chore(tests): add global mock for ioredis to stabilize test environment"
```

---

### **Part 2: API and Worker Implementation (The TDD Cycle)**

Now we follow our standard Red-Green-Refactor workflow on a stable foundation.

#### Commit 1: RED — Write Failing Tests for the New Feature

##### **Action 1: Update `journals.test.ts` Expectations**

Modify `tests/integration/journals.test.ts` to assert that the created journal's `status` is `'PENDING'`.

```typescript
// file: tests/integration/journals.test.ts
// ... (imports and beforeEach/afterEach remain the same)

describe("POST /api/journals", () => {
  // ... (beforeEach, afterEach, afterAll setup)

  // ... (401 and 403 tests remain the same)

  it("should return 201 Created and status PENDING for a valid request", async () => {
    const res = await agent
      .post("/api/journals")
      .set("x-test-user-id", user1.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);
    // THIS IS THE NEW ASSERTION
    expect(res.body.journal.status).toBe("PENDING");
  });
});
```

##### **Action 2: Create the Targeted Mocked Integration Test for the Queue**

This test will verify that our API route correctly calls the queue logic. It will mock our _own module_ (`src/lib/queue.ts`) for perfect isolation.

```typescript
// file: tests/integration/queue.test.ts

import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { PrismaClient, User } from "@prisma/client";
import session from "supertest-session";
import * as http from "http";
import type { Express } from "express";

// --- This is the key to our targeted mocking pattern ---

// 1. Create a mock queue object that we can control and inspect.
const mockQueueInstance = {
  add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
};

// 2. Tell Jest: "When the application asks for src/lib/queue.js,
//    give it this fake version instead."
jest.unstable_mockModule("../../src/lib/queue.js", () => ({
  getJournalQueue: () => mockQueueInstance,
  JOURNAL_QUEUE_NAME: "test-queue",
}));

// 3. Now, when we dynamically import our app, it will be wired up to our mock.
const { createApp } = await import("../../src/index.js");

// --- End of pattern ---

const prisma = new PrismaClient();
let app: Express;
let server: http.Server;
let agent: session.Session;
let testUser: User;
let csrfToken: string;

describe("API to Mock Job Queue Integration", () => {
  beforeAll(async () => {
    app = createApp();
    server = app.listen(0, async () => {
      agent = session(app);
      // ... database setup
      await prisma.user.deleteMany();
      testUser = await prisma.user.create({
        data: {
          email: `queue-test-user-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: "https://test.ns.com",
        },
      });
      const res = await agent.get("/api/csrf-token");
      csrfToken = res.body.csrfToken;
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    server.close();
  });

  beforeEach(() => {
    mockQueueInstance.add.mockClear();
  });

  it("should call the queue.add method when creating a journal", async () => {
    const res = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    const journalId = res.body.journal.id;

    expect(mockQueueInstance.add).toHaveBeenCalledWith("process-journal", {
      journalId: journalId,
    });
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
  });
});
```

##### **Action 3: Verify the "RED" State and Commit**

Run the tests.

```bash
npm test
```

**Expected Outcome:** Both `journals.test.ts` and `queue.test.ts` will now fail on clean `expect()` assertions. This is our perfect "RED" state.

```bash
git add .
git commit -m "test(api): add failing tests for job queuing on journal creation"
```

---

#### Commit 2: GREEN — Implement the Feature and Make All Tests Pass

This commit introduces the application code to make our failing tests turn green.

##### **Action 1: Create the Lazy-Initialized Queue Module**

This new architecture prevents the application from connecting to Redis unless it's actually needed.

```typescript
// file: src/lib/queue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

let queueInstance: Queue | null = null;

export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || "journal-processing";

/**
 * A singleton factory function to get the journal queue instance.
 * It creates the connection and queue only on the first call.
 */
export function getJournalQueue(): Queue {
  if (!queueInstance) {
    const connection = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT!, 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    queueInstance = new Queue(JOURNAL_QUEUE_NAME, {
      connection,
    });
  }
  return queueInstance;
}
```

##### **Action 2: Update the Journal Route to Use the Queue**

Modify `src/routes/journal.ts` to use our new factory function and add the job.

```typescript
// file: src/routes/journal.ts
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getJournalQueue } from "../lib/queue.js"; // Import the factory function

const router = Router();

router.post("/", async (req, res, next) => {
  const userId = req.user!.id;
  let journal;

  try {
    // 1. Create the journal with PENDING status.
    journal = await prisma.journal.create({
      data: { userId, status: "PENDING" },
    });

    // 2. Get the queue and enqueue the job.
    const journalQueue = getJournalQueue();
    await journalQueue.add("process-journal", { journalId: journal.id });

    res.status(201).json({ journal });
  } catch (error) {
    // 3. CRITICAL ROLLBACK LOGIC
    if (journal) {
      console.error(
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back.`
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }
    next(error);
  }
});

export default router;
```

##### **Action 3: Implement Remaining Setup**

You will also need the `docker-compose.yml`, `worker.ts`, `ecosystem.config.cjs`, and updated `package.json` scripts from the previous plans. Ensure all dependencies (`bullmq`, `ioredis`, `pm2`) are installed.

##### **Action 4: Verify Success and Commit**

1.  **Run automated tests.** All tests should now **PASS**. This is our "GREEN" state.
    ```bash
    npm test
    ```
2.  **Manually test the full flow:**
    1.  Run `just run` in one terminal.
    2.  Run `just logs` in another.
    3.  Trigger the `POST /api/journals` endpoint.
    4.  Observe the logs to confirm the API responds instantly and the worker log appears shortly after.
3.  **Commit the work.**
    ```bash
    git add .
    git commit -m "feat(worker): integrate bullmq for background job processing"
    ```

---

## 4. Conclusion

Congratulations. After a significant debugging effort, you have not only implemented a scalable job queue system but have also built a robust, multi-layered, and stable test suite to support it. The patterns established here—global mocking for problematic dependencies and targeted mocking for application logic—are professional-grade techniques that will ensure our project is maintainable and reliable for the long term.
