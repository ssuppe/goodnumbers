# Engineering Plan: Phase 3, Task 2 - Background Job Queue Setup (Revised and Hardened)

**Author:** Dr. Gemini, Technical Lead
**Date:** 2025-08-22
**Status:** Not Started

## 1. Overview & Goal

This document provides a comprehensive, step-by-step guide for a junior engineer to complete **Phase 3, Task 2**. The goal is to integrate a background job processing system using **BullMQ** with a **Redis** backend.

This is a critical architectural step that decouples long-running tasks (like fetching data and generating AI content) from the main web server, ensuring the user interface remains fast and responsive. For this task, we will focus on the foundational setup:

1.  Configuring a local, secure Redis instance using Docker.
2.  Integrating the `bullmq` library into our application.
3.  Modifying the journal creation endpoint (`POST /api/journals`) to enqueue a new job.
4.  Creating a basic background worker that simply listens for and logs new jobs.

We will follow the project's Test-Driven Development (TDD) methodology precisely.

## 2. Development Environment Philosophy: A Hybrid Approach

In our previous discussion, you brought up an excellent point about the development workflow. For this phase, we will adopt a **hybrid development model**, which is a common best practice in the industry.

- **Services Run in Docker:** We will run our backing services, like the Redis database, inside a Docker container. This gives us a consistent, isolated, and secure environment for our dependencies without needing to install them directly on our local machine.
- **Application Code Runs Locally:** We will continue to run our Node.js application directly on our machine using `npm run dev` and `npm run worker`. This gives us the fast feedback loop and hot-reloading capabilities of `nodemon`, which is essential for productive development.

This approach provides the best of both worlds: the stability and consistency of Docker for services, and the speed and flexibility of local development for our own code.

## 3. Step-by-Step Implementation Guide

### Step 3.1: GitHub Issue and Branch Setup

First, as per our `DEVELOPMENT_PROCESS.md`, create a GitHub issue to track this task.

````bash
# Run this from the project's root directory (goodnumbers-workspace)
gh issue create --title "feat(worker): P3_T2 integrate bullmq for background job processing" --body "This task involves setting up BullMQ with Redis to handle background jobs for journal creation. It includes modifying the journal creation API to enqueue jobs and creating a skeleton worker to process them. Reference: docs/eng/PHASE3_TASK2.md"```

Note the issue number that is created (e.g., #55). Now, create your feature branch from the latest `develop` branch.

```bash
# Ensure your local develop branch is up to date
git checkout develop
git pull

# Create the feature branch using the new issue number
git checkout -b feat/55-bullmq-integration
````

### Step 3.2: Dependency Installation

Navigate into the `goodnumbers` project directory and install the necessary libraries for BullMQ and Redis.

```bash
cd goodnumbers
npm install bullmq ioredis
npm install -D @types/ioredis
cd ..
```

- `bullmq`: The powerful job queue library we will use.
- `ioredis`: A robust and performant Redis client for Node.js that BullMQ uses under the hood.
- `@types/ioredis`: TypeScript definitions for `ioredis`.

### Step 3.3: Local Environment Setup (Docker for Redis)

We will now define our local Redis service using Docker Compose.

**1. Create the Docker Compose File**

This file will define and configure our Redis service. Create a new file at `goodnumbers/docker-compose.yml`.

```yaml
# file: goodnumbers-workspace/goodnumbers/docker-compose.yml
version: "3.8"

services:
  # The Redis service
  redis:
    image: redis:7-alpine
    restart: always
    # SECURITY BEST PRACTICE: This sets the required password for Redis.
    # The value is fetched from the .env file on your local machine. Never run
    # Redis in a networked environment without a password.
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      # SECURITY NOTE: This binds the Redis port inside the container to your
      # local machine's loopback address (127.0.0.1 or localhost). This is
      # crucial for our hybrid setup as it allows your locally running Node.js
      # app to connect to it. Binding to 127.0.0.1 is slightly more secure
      # than "6379:6379" as it prevents other devices on your local network
      # from attempting to connect to your Redis instance.
      - "127.0.0.1:6379:6379"
    volumes:
      # (Optional but Recommended) This makes your Redis data persist even
      # if you stop and restart the container. It's very useful for development.
      - redis-data:/data

volumes:
  redis-data:
```

**2. Update Environment Configuration**

We need to add the new Redis configuration variables to our example environment file. This is a critical security step. We must not commit weak or default passwords.

**Action:** Update the `goodnumbers/.env.example` file to include the new Redis variables. Note that we are leaving the password blank as a clear signal that a strong, unique password must be generated by the developer.

````markdown
# file: goodnumbers-workspace/goodnumbers/.env.example

# --- Core App Secrets ---

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ENCRYPTION_KEY=
CSRF_SECRET=
AUTH_SECRET=

# --- Google OAuth Credentials ---

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- Server Configuration ---

PORT=3000

# --- Redis Configuration ---

# The host for the local Redis instance running in Docker.

REDIS_HOST=127.0.0.1

# The port for Redis, matching the docker-compose.yml file.

REDIS_PORT=6379

# SECURITY: A strong, unique password for your local Redis instance.

# Generate one with a password manager or a command like:

# openssl rand -base64 32

REDIS_PASSWORD=```

**Action:** If you haven't already, create a `.env` file in the `goodnumbers/` directory by copying `.env.example`. Fill in all the values, including generating a strong, unique password for `REDIS_PASSWORD`.

### Step 3.4: The Recommended Development Workflow (Three-Terminal Setup)

To work on this task, you will use **three separate terminals**, all navigated to the `goodnumbers/` directory. This approach gives you clear, separate logs for your services, your API server, and your background worker, which is incredibly helpful for debugging.

**Terminal 1: Start Backing Services (Redis)**
In this terminal, you will start the Redis service using Docker. It will run in the foreground, showing you live logs from the Redis server.

```bash
# In goodnumbers/
docker-compose up
```
````

**Terminal 2: Start the API Server**
In your second terminal, you will run the Node.js web server with `nodemon` as usual. This process handles all HTTP requests.

```bash
# In goodnumbers/
npm run dev
```

**Terminal 3: Start the Background Worker**
In your third terminal, you will start the new background worker process. This process does not listen for HTTP requests; it only listens for jobs from the Redis queue.

```bash
# In goodnumbers/
# You will add the "worker" script to package.json in a later step.
npm run worker
```

Your locally running Node.js application and worker will now be able to connect to the Redis server running inside Docker.

### Step 3.5: Test-Driven Implementation

Now we will follow the Red-Green-Refactor cycle to build the feature.

#### **1. (RED) Write the Failing Test**

First, we'll create an integration test that checks if creating a journal successfully adds a job to the Redis queue. This test will fail because we haven't implemented the queueing logic yet.

```typescript
// file: goodnumbers-workspace/goodnumbers/tests/integration/queue.test.ts
import "dotenv/config";
import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
} from "@jest/globals";
import type { User } from "@prisma/client";
import type Redis from "ioredis";

// Use a unique queue name for testing to avoid conflicts with a running dev server
const TEST_QUEUE_NAME = `test-journal-queue-${Date.now()}`;

// ====================================================================================
// CORRECTED MOCKING STRATEGY (Following ES Module Best Practices)
//
// As per IMPLEMENTATION_PLAN.md, we use `jest.unstable_mockModule` for mocking
// in our ES Module project. This is called at the top level, *before* any modules are
// imported, guaranteeing that our mock is in place before any application code runs.
// =================================e===================================================
jest.unstable_mockModule('../../src/lib/queue', async () => {
  // CORRECTED: Use dynamic `await import()` instead of `require()`
  const { Queue: BullQueue } = await import('bullmq');
  // CORRECTED: `ioredis` uses a default export, so we must access it with `.default`
  const RedisClient = (await import('ioreis')).default;

  const testConnection = new RedisClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const testJournalQueue = new BullQueue(TEST_QUEUE_NAME, {
    connection: testConnection,
  });
  console.log(`[TEST_MOCK] Created mock BullMQ queue: ${TEST_QUEUE_NAME}`);

  return {
    __esModule: true,
    journalQueue: testJournalQueue,
    JOURNAL_QUEUE_NAME: TEST_QUEUE_NAME,
  };
});

describe("BullMQ Job Queue Integration", () => {
  let testUser: User;
  let agent: import("supertest").SuperAgentTest;
  let csrfToken: string;
  let testQueue: import("bullmq").Queue;
  let prisma: import("@prisma/client").PrismaClient;
  let app: import("express").Express;

  beforeAll(async () => {
    console.log(
      "[TEST_SETUP] Starting beforeAll for queue integration test..."
    );
    // Dynamically import all necessary modules AFTER the mock has been set up.
    const queueModule = await import("../../src/lib/queue");
    const dbModule = await import("../../src/db");
    const appModule = await import("../../src/index");
    const supertest = (await import("supertest")).default;

    testQueue = queueModule.journalQueue;
    prisma = dbModule.prisma;
    app = appModule.default;

    console.log(
      "[TEST_SETUP] Obliterating test queue to ensure clean state..."
    );
    await testQueue.obliterate({ force: true });

    console.log("[TEST_SETUP] Deleting and creating test user...");
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: { email: "queue-test@example.com" },
    });
    console.log(`[TEST_SETUP] Test user created with ID: ${testUser.id}`);

    agent = supertest.agent(app);
    console.log("[TEST_SETUP] Fetching CSRF token...");
    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;
    console.log("[TEST_SETUP] beforeAll complete.");
  });

  afterEach(async () => {
    console.log("[TEST_TEARDOWN] Cleaning queue after test...");
    await testQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    console.log("[TEST_TEARDOWN] Closing queue and database connections...");
    await testQueue.close();
    (testQueue.connection as Redis).disconnect();
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
    console.log("[TEST_TEARDOWN] All connections closed.");
  });

  it("POST /api/journals should enqueue a job in BullMQ", async () => {
    console.log(
      "[TEST_RUN] Executing test: POST /api/journals should enqueue a job..."
    );
    // Act: Call the endpoint to create a journal.
    const response = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .set("x-csrf-token", csrfToken)
      .send({});

    console.log(`[TEST_RUN] API response status: ${response.status}`);
    expect(response.status).toBe(201);
    const journalId = response.body.id;
    console.log(`[TEST_RUN] Journal created with ID: ${journalId}`);

    // Assert: Check if a job was added to our test queue.
    console.log("[TEST_RUN] Checking for jobs in the test queue...");
    const jobs = await testQueue.getJobs(["waiting"]);
    console.log(`[TEST_RUN] Found ${jobs.length} job(s).`);

    expect(jobs).toHaveLength(1);
    expect(jobs.data.journalId).toBe(journalId);
    expect(jobs.name).toBe("generate-journal");
    console.log(`[TEST_RUN] Job data validated successfully.`);
  });
});
```

Run this new test file (`npm test -- tests/integration/queue.test.ts`). It will fail because the API is not yet queueing jobs. This is our "Red" state.

#### **2. (GREEN) Implement the Queueing Logic**

Now, let's write the code to make the test pass.

**a. Create a Centralized Queue Configuration**

This file will manage the connection to Redis and export our BullMQ `Queue` instance.

```typescript
// file: goodnumbers-workspace/goodnumbers/src/lib/queue.ts
import { Queue } from "bullmq";
import Redis from "ioredis";

// Define the name of our queue. Exporting it ensures that the worker and
// the API server are always using the exact same queue name.
export const JOURNAL_QUEUE_NAME = "journal-generation";

// Create a single Redis connection instance. BullMQ is optimized to reuse this
// connection for all queue operations, which is highly efficient.
const connection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Recommended setting for BullMQ
});

// ROBUSTNESS: Add an error handler to the Redis connection. If the Node.js
// process can't connect to Redis, this will log a clear error message instead
// of crashing silently or timing out opaquely. This is crucial for debugging.
connection.on("error", (err) => {
  console.error("[FATAL] Redis connection error:", err);
});

// Create and export the BullMQ queue instance. This will be imported by our
// API server to add jobs.
export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, { connection });
```

**b. Modify the Journal Creation Endpoint**

Update `goodnumbers/src/routes/journals.ts` to add a job to the queue when a new journal is created. We only need to add two lines of code to the existing `POST /api/journals` endpoint.

```typescript
// file: goodnumbers-workspace/goodnumbers/src/routes/journals.ts
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { protect } from "../middleware/auth.js";
import { journalQueue } from "../lib/queue.js"; // <-- IMPORT THE QUEUE

const router = Router();

// Zod schema for validating CUIDs in route parameters
const paramsSchema = z.object({
  id: z.string().cuid2({ message: "Invalid ID format" }),
});

// GET /api/journals - Fetch all journals for the logged-in user
router.get("/", protect, async (req, res, next) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(journals);
  } catch (error: unknown) {
    next(error);
  }
});

// GET /api/journals/:id - Fetch a single journal by its ID
router.get("/:id", protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const { id } = validation.data;

    const journal = await prisma.journal.findUnique({
      where: {
        id: id,
        userId: userId, // Ownership Check
      },
      include: {
        clusters: true,
      },
    });

    if (!journal) {
      return res.status(404).json({ error: "Journal not found" });
    }
    res.status(200).json(journal);
  } catch (error: unknown) {
    next(error);
  }
});

// POST /api/journals - Create a new journal entry
router.post("/", protect, async (req, res, next) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const newJournal = await prisma.journal.create({
      data: {
        userId: userId,
        status: "PENDING",
        progress: 0,
      },
    });

    // --- NEW LOGIC: Enqueue the background job ---
    // Here we add a new job to the queue.
    // The first argument is a name for this type of job, which is useful for debugging.
    // The second argument is the payload, containing the data our worker needs.
    await journalQueue.add("generate-journal", { journalId: newJournal.id });

    // We still return the new journal record immediately to the user.
    res.status(201).json(newJournal);
  } catch (error: unknown) {
    // CONSISTENCY NOTE: We are using next(error) to pass control to our global
    // error handler. This is the preferred pattern in our application.
    next(error);
  }
});

// GET /api/journals/status/:id - Poll for journal generation progress
router.get("/status/:id", protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const { id } = validation.data;

    const journalStatus = await prisma.journal.findUnique({
      where: { id: id, userId: userId },
      select: {
        status: true,
        progress: true,
        statusMessage: true,
      },
    });

    if (!journalStatus) {
      return res.status(404).json({ error: "Journal not found" });
    }
    res.status(200).json(journalStatus);
  } catch (error: unknown) {
    next(error);
  }
});

const updateJournalSchema = z.object({
  weeklyVibe: z.string().optional(),
  influencingFactors: z.array(z.string()).optional(),
  goalsForNextWeek: z.string().optional(),
  clusterNotes: z.record(z.string().cuid2(), z.string()).optional(),
});

router.put("/:id", protect, async (req, res, next) => {
  try {
    const paramsValidation = paramsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: paramsValidation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const { id } = paramsValidation.data;

    const bodyValidation = updateJournalSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: bodyValidation.error.flatten().fieldErrors,
      });
    }
    const { clusterNotes, ...journalData } = bodyValidation.data;

    await prisma.$transaction(async (tx) => {
      const journalUpdateResult = await tx.journal.updateMany({
        where: { id: id, userId: userId },
        data: journalData,
      });

      if (journalUpdateResult.count === 0) {
        throw new Error("Journal not found or permission denied");
      }

      if (clusterNotes) {
        for (const clusterId in clusterNotes) {
          await tx.glycemicEventCluster.updateMany({
            where: { id: clusterId, journalId: id },
            data: { userNotes: clusterNotes[clusterId] },
          });
        }
      }
    });

    const updatedJournal = await prisma.journal.findUnique({
      where: { id },
      include: { clusters: true },
    });

    res.status(200).json(updatedJournal);
  } catch (error: unknown) {
    if ((error as Error).message.includes("permission denied")) {
      return res.status(404).json({ error: "Journal not found" });
    }
    next(error);
  }
});

router.delete("/:id", protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request parameter",
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const { id } = validation.data;

    const deleteResult = await prisma.journal.deleteMany({
      where: { id: id, userId: userId },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: "Journal not found" });
    }

    res.status(204).send();
  } catch (error: unknown) {
    next(error);
  }
});

export { router as journalsRouter };
```

**c. Create the Background Worker Entry Point**

This is the new, separate process that will listen for and process jobs.

```typescript
// file: goodnumbers-workspace/goodnumbers/src/worker.ts
import "dotenv/config"; // Make sure to load environment variables first
import { Worker } from "bullmq";
import Redis from "ioredis";

// Import the queue name to ensure consistency with the API server.
import { JOURNAL_QUEUE_NAME } from "./lib/queue.js";

// The worker needs its own connection to Redis.
const connection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

console.log(
  `[WORKER_STARTUP] Worker process started, connected to Redis on ${process.env.REDIS_HOST}. Listening for jobs on queue: '${JOURNAL_QUEUE_NAME}'`
);

// Create a new Worker instance.
// The first argument is the queue name it should listen to.
// The second argument is the "processor" function that will be called for each job.
const worker = new Worker(
  JOURNAL_QUEUE_NAME,
  async (job) => {
    // This is where the actual work happens.
    // For this task, we just log the job data to confirm it was received.
    // In future tasks, this is where we will fetch Nightscout data and call the AI.
    console.log(
      `[WORKER_JOB_PROCESSING] Processing job #${job.id} with name '${job.name}' for journal: ${job.data.journalId}`
    );

    // Simulate some work, like a long-running API call.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`[WORKER_JOB_COMPLETED] Finished processing job #${job.id}`);

    // The return value can be used to store a result for the job.
    return { status: "Complete", journalId: job.data.journalId };
  },
  { connection }
);

// Listen to events emitted by the worker. This is great for logging and monitoring.
worker.on("completed", (job, result) => {
  console.log(
    `[WORKER_EVENT] Job ${job.id} has completed successfully! Result:`,
    result
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[WORKER_EVENT] Job ${job?.id} has failed with error: ${err.message}`,
    err
  );
});

worker.on("error", (err) => {
  console.error("[WORKER_EVENT] A worker error occurred:", err);
});

// --- BEST PRACTICE: Graceful Shutdown ---
// This is critical for a background worker. If the process is killed suddenly
// (e.g., during a deployment or by pressing Ctrl+C), we want to allow any
// currently running job to finish before the process exits. Otherwise, we could
// leave a journal in a half-processed, corrupted state. BullMQ's `worker.close()`
// handles this for us: it waits for the current job to complete before resolving.
const gracefulShutdown = async (signal: string) => {
  console.log(
    `[WORKER_SHUTDOWN] Received ${signal}, shutting down gracefully...`
  );
  await worker.close();
  console.log(
    "[WORKER_SHUTDOWN] All active jobs processed. Closing Redis connection."
  );
  await connection.quit();
  process.exit(0);
};

// Listen for termination signals from the OS
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Ctrl+C
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // `kill` command
```

**d. Add a Worker Script to `package.json`**

This allows us to run the worker process easily from the command line.

```json
// file: goodnumbers-workspace/goodnumbers/package.json
{
  "name": "goodnumbers",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node dist/index.js",
    "worker": "node dist/worker.js",
    "//": "The 'dev' script now only runs the API server via nodemon.",
    "//": "The developer will run 'docker-compose up' and 'npm run worker' in separate terminals.",
    "dev": "nodemon",
    "build": "tsc",
    "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --detectOpenHandles",
    "lint": "eslint . --ext .ts",
    "prettier": "prettier --write .",
    "test-all": "NODE_OPTIONS=\"--experimental-vm-modules\" jest"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "src/**/*.{ts,tsx},tests/**/*.{ts,tsx}": ["npm run test-all"]
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module",
  "dependencies": {
    "@auth/express": "^0.11.0",
    "@auth/prisma-adapter": "^2.10.0",
    "@paralleldrive/cuid2": "^2.2.2",
    "@prisma/client": "^6.14.0",
    "bullmq": "^5.10.2",
    "cookie-parser": "^1.4.7",
    "csrf-csrf": "^4.0.3",
    "dotenv": "^17.2.1",
    "express": "^5.1.0",
    "express-rate-limit": "^8.0.1",
    "helmet": "^8.1.0",
    "ioredis": "^5.4.1",
    "jest-environment-jsdom": "^30.0.5",
    "next-auth": "^4.24.11",
    "prisma": "^6.14.0",
    "zod": "^4.0.17"
  },
  "devDependencies": {
    "@eslint/js": "^9.33.0",
    "@types/cookie-parser": "^1.4.9",
    "@types/express": "^5.0.3",
    "@types/ioredis": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/next-auth": "^3.13.0",
    "@types/node": "^24.3.0",
    "@types/supertest": "^6.0.3",
    "@typescript-eslint/eslint-plugin": "^8.39.1",
    "@typescript-eslint/parser": "^8.39.1",
    "concurrently": "^8.2.2",
    "eslint": "^9.33.0",
    "globals": "^16.3.0",
    "husky": "^9.1.7",
    "jest": "^30.0.5",
    "lint-staged": "^16.1.5",
    "nodemon": "^3.1.10",
    "prettier": "^3.6.2",
    "supertest": "^7.1.4",
    "ts-jest": "^29.4.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.39.1"
  }
}
```

Now, re-run the tests. They should pass, and you will see the detailed debug logs in your console.

### Step 3.6: Commit and Create Pull Request

You have successfully implemented the job queue. Now, commit your work and open a Pull Request.

```bash
# From the goodnumbers-workspace directory
git add .
git commit -m "feat(worker): P3_T2 integrate bullmq for background job processing" -m "This commit introduces BullMQ and Redis to the project. The journal creation endpoint now enqueues a job for asynchronous processing. A new worker process has been created to listen for these jobs. The local development environment now uses Docker Compose for a secure and consistent Redis service."

# Push the branch
git push --set-upstream origin feat/55-bullmq-integration

# Create the Pull Request
gh pr create --base develop --title "feat(worker): P3_T2 integrate bullmq for background job processing" --body "Closes #55. This PR adds the foundational BullMQ and Redis infrastructure for background job processing. Journals are now enqueued for generation instead of being processed in-request."
```

You have now completed the task with a robust, secure, and professional development setup. The detailed logs will make it much easier to trace the flow of data from the API request to the background worker.
