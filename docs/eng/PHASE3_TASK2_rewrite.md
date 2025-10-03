Of course. Here is the complete, rewritten implementation plan. I have incorporated all the changes we discussed to pivot to a mock-based testing strategy, add dedicated unit tests for the worker, and improve the overall structure and clarity for the junior engineer.

You can copy and paste the entire content below.

---

# Goodnumbers — PHASE 3, TASK 2: Implement Asynchronous Job Queue

**Version:** 5.0 (Revised with Mock-Based Integration Testing)
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
  - **Method:** We use Jest's mocking capabilities to replace the `bullmq` library with a lightweight, in-memory fake version that we control.
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

##### **Action 2: Create a Reusable Manual Mock for BullMQ**

A "manual mock" is a convention where we tell Jest exactly how to fake a library. This gives us full control and makes our tests clean and reliable.

Create a new directory and file at `tests/__mocks__/bullmq.ts`.

```typescript
// file: tests/__mocks__/bullmq.ts

import { jest } from "@jest/globals";

// This is our in-memory fake database for jobs.
// Using a dictionary of arrays lets us mimic job states like 'waiting'.
let jobs = {
  waiting: [],
};

// This is the mock implementation of the BullMQ 'Queue' class.
export const Queue = jest.fn().mockImplementation((queueName) => {
  return {
    name: queueName,
    // The `add` method is called by our application code.
    add: jest.fn().mockImplementation(async (jobName, jobData) => {
      const newJob = {
        id: Math.random().toString(), // A simple unique ID for testing
        name: jobName,
        data: jobData,
      };
      jobs.waiting.push(newJob);
      return newJob;
    }),
    // The `getJobs` method is used by our test to check the queue's state.
    getJobs: jest.fn().mockImplementation(async (states) => {
      let results = [];
      for (const state of states) {
        if (jobs[state]) {
          results = results.concat(jobs[state]);
        }
      }
      return results;
    }),
    // `obliterate` is used by tests to ensure a clean slate.
    obliterate: jest.fn().mockImplementation(async () => {
      jobs = { waiting: [] };
    }),
    // `close` is used by tests for graceful shutdown.
    close: jest.fn().mockResolvedValue(undefined),
  };
});

// Helper function to access the mock's internal state from a test.
export const getMockQueue = () => ({
  jobs,
});
```

##### **Action 3: Create the Mocked Integration Test**

This test will verify our API's logic using the mock we just created.

Create a new file at `tests/integration/queue.test.ts`.

```typescript
// file: tests/integration/queue.test.ts

import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { PrismaClient, User } from "@prisma/client";
import session from "supertest-session";
import * as http from "http";
import type { Express } from "express";
import { createApp } from "../../src/index.js";
import { Queue, getMockQueue } from "bullmq"; // Import the mocked version

// Tell Jest to use our manual mock instead of the real 'bullmq' library.
jest.mock("bullmq");

const prisma = new PrismaClient();
let app: Express;
let server: http.Server;
let agent: session.Session;
let testUser: User;
let csrfToken: string;

// We need a way to reference the mock instance inside our tests.
let mockQueueInstance: any;

describe("API to Mock Job Queue Integration", () => {
  beforeAll(async () => {
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    agent = session(app);

    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: {
        email: `mock-queue-test-${Date.now()}@example.com`,
        agreementsSigned: true,
        nightscoutUrl: "https://mock-queue.ns.com",
      },
    });

    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;

    // Get a reference to the mock instance created by the app
    mockQueueInstance = (Queue as jest.Mock).mock.results[0].value;
    await mockQueueInstance.obliterate(); // Clear the mock queue
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("POST /api/journals should create a journal and add a job to the mock queue", async () => {
    // Act
    const response = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(201);
    const journalId = response.body.journal.id;

    // Assert
    // Check that our application code called the mock's `add` method correctly.
    expect(mockQueueInstance.add).toHaveBeenCalledWith("process-journal", {
      journalId: journalId,
    });

    // We can also check the mock's internal state.
    const jobsInQueue = getMockQueue().jobs.waiting;
    expect(jobsInQueue).toHaveLength(1);
    expect(jobsInQueue[0].data.journalId).toBe(journalId);
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

````bash
cd goodnumbers
npm install bullmq ioredis
npm install --save-dev pm2```

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
````

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

// NOTE: We are intentionally not using the IORedis compatibility layer here
// as it was part of the previous attempt. BullMQ handles the Redis connection.
const connection = new IORedis(process.env.REDIS_URL!, {
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
const connection = new IORedis(process.env.REDIS_URL!, {
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

```javascript
// file: goodnumbers/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "goodnumbers-web",
      script: "./dist/index.js",
      exec_mode: "cluster",
    },
    {
      name: "goodnumbers-worker",
      script: "./dist/worker.js",
      exec_mode: "fork",
    },
  ],
};
```

##### **Action 8: Add/Update Scripts in `package.json`**

```json
// file: goodnumbers/package.json
{
  // ...
  "scripts": {
    "start": "pm2 start ecosystem.config.cjs --env production",
    "stop": "pm2 stop ecosystem.config.cjs && pm2 delete ecosystem.config.cjs",
    "dev": "pm2 start ecosystem.config.cjs --watch",
    "logs": "pm2 logs",
    "build": "tsc",
    "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --runInBand",
    "lint": "eslint . --ext .ts",
    "prettier": "prettier --write ."
  }
  // ...
}
```

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
    await processJournalJob(fakeJob);

    // Assert: Check that our logic updated the journal correctly
    expect(prisma.journal.update).toHaveBeenCalledWith({
      where: { id: "journal123" },
      data: {
        status: "COMPLETE",
        // In the future, we'll assert more data is saved here
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

Modify the worker to export the processing logic so we can test it.

```typescript
// file: src/worker.ts
import "./lib/env.js";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { JOURNAL_QUEUE_NAME } from "./lib/queue.js";
import { prisma } from "./lib/prisma.js"; // Import prisma

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
if (process.env.NODE_ENV !== "test") {
  console.log("[Worker] Starting up...");
  const connection = new IORedis(process.env.REDIS_URL!, {
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

  // Arrange: Simulate a failure by having the DB call throw an error
  (prisma.journal.update as jest.Mock)
    .mockRejectedValueOnce(new Error(errorMessage)) // First call fails
    .mockResolvedValueOnce({}); // Second call (to set FAILED status) succeeds

  // Act
  await processJournalJob(fakeJob);

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
    // Re-throw the error so BullMQ knows the job failed
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
