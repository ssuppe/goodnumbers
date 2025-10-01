# Goodnumbers — PHASE 3, TASK 2: Implement Asynchronous Job Queue

**Version:** 4.0 (Corrected with Advanced Testing Patterns)
**Author:** Technical Lead
**Date:** 2025-09-30
**Status:** Approved for Implementation

## 1. Overview & Purpose (The "Why")

Welcome to a foundational task for the Goodnumbers application. The journal generation process is a heavy operation, involving external API calls, data analysis, and AI processing. If we were to run this process directly within an API request, it would take far too long, leading to request timeouts for the user and making our server unresponsive. This creates a poor user experience and a fragile system.

To solve this, we are implementing an **asynchronous job queue**. This is a standard and powerful architectural pattern that decouples the initial, quick user request from the slow, intensive background work.

Here’s how it works:

1.  **The API (Producer):** The user's request to create a journal hits our API. The API's _only_ job is to create a placeholder record in the database with a `PENDING` status and then place a "job" onto a queue. It then immediately responds to the user with a `201 Created` status. This entire process is extremely fast.
2.  **The Queue (Message Broker):** We will use Redis as a high-speed message broker that holds these jobs.
3.  **The Worker (Consumer):** We will run a completely separate, standalone Node.js process. Its only job is to watch the queue for new jobs. When it sees one, it picks it up and performs all the heavy lifting (fetching data, calling AI, etc.).

This document is the complete, definitive guide to implementing this system correctly, including the robust testing patterns required to ensure it is reliable.

## 2. Architecture & Technology Selection

- **Redis:** A high-performance, in-memory data store. It's the industry standard for message brokers and caching. We will run it inside a Docker container for a consistent environment.
- **BullMQ:** A modern, powerful, and reliable job queue library for Node.js that is built on top of Redis.
- **Docker Compose:** A tool for defining and running multi-container applications. We will use it to manage our Redis service, making setup trivial for any developer.
- **PM2:** A production-grade process manager for Node.js. We need this because our application now consists of two long-running processes (the web server and the worker), and PM2 is excellent at managing them.
- **Just:** A command runner that simplifies our development workflow, providing single, memorable commands to orchestrate Docker, PM2, and NPM.

## 3. The Critical Lesson: Ensuring True Test Isolation

Before we write a single line of code, it is essential to understand the primary reason the previous tests were failing. The problem was not the application logic, but a subtle and advanced issue in the test setup related to **module caching**. This is a vital lesson for any engineer working with Node.js.

### The Problem: Premature Configuration

In our application, the `src/lib/queue.ts` file creates a **singleton** instance of the BullMQ queue. This means the queue connection is created _once_ when the module is first loaded and then reused everywhere.

The failing test (`tests/integration/real-queue.test.ts`) was written like this:

```typescript
// The OLD, PROBLEMATIC way
import { createApp } from '../../src/index.js'; // <-- PROBLEM! This loads the app immediately.

const TEST_QUEUE_NAME = `test-real-queue-${Date.now()}`;
process.env.QUEUE_NAME = TEST_QUEUE_NAME; // <-- This is set TOO LATE.

describe('...', () => {
  beforeAll(async () => {
    app = createApp(); // <-- The app is created using the old, default queue name.
    // ...
  });
});
```

The `import` statement at the top of the file caused the `queue.ts` module to be loaded and configured _before_ our test had a chance to set the `process.env.QUEUE_NAME`. The test was looking for jobs in one queue, while the application was sending them to another.

### The Solution: Control the Environment _Before_ You Import

The previous working version from `goodnumbers-workspace2` demonstrated the correct, robust pattern. We must control the environment first, and only then load the application code.

```typescript
// The NEW, CORRECT pattern
// ... test library imports ...

describe('...', () => {
  let createApp; // Use a variable to hold the imported function

  beforeAll(async () => {
    // 1. Give yourself a clean slate by clearing Jest's module cache.
    jest.resetModules();

    // 2. Set up your test-specific environment.
    process.env.QUEUE_NAME = `test-queue-${Date.now()}`;

    // 3. NOW, and only now, dynamically import the application code.
    //    This guarantees it will read our overridden environment variable on its first load.
    const appModule = await import('../../src/index.js');
    createApp = appModule.createApp;

    // ... continue with the rest of the setup ...
  });
});
```

This `jest.resetModules() -> set environment -> await import()` sequence is the key takeaway. We will use this precise pattern in our new test file.

## 4. Developer Environment & Workflow

To make running our multi-process application and its dependencies trivial, we will use Docker Compose and a `Justfile`.

### Why Separate `dev` and `test` Commands?

You will notice our `Justfile` has `services-up` for development and `test-env-up` for testing. This is a deliberate safety measure.

- **Preventing Data Loss:** Our tests are destructive; they are designed to `obliterate` queues to ensure a clean state. Your `.env.test` file correctly points to a separate Redis database (`REDIS_DB=1`), protecting your development data (`REDIS_DB=0`). The separate commands create a clear mental distinction, preventing you from accidentally running tests against your development data.
- **Clarity of Intent:** `just run` means "run the full dev application." `just test-ci` means "run the automated test suite." The different command names make their purpose obvious.

Here is the complete `Justfile` we will use.

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

# Starts the Redis service required for integration tests.
# The '-d' flag runs it in the background (detached mode).
test-env-up:
    @echo "Starting Redis container for testing..."
    @docker-compose up -d redis

# Stops the Redis service used for testing.
test-env-down:
    @echo "Stopping Redis container for testing..."
    @docker-compose down

# Runs the entire test suite.
# Assumes the test environment (Redis) is already running.
test:
    @echo "Running the test suite..."
    @npm test

# The all-in-one command for Continuous Integration or a quick, clean test run.
# It starts the environment, runs the tests, and then guarantees a clean shutdown.
test-ci:
    @echo "Running CI test cycle: Starting services -> Running tests -> Tearing down..."
    @just test-env-up
    @npm test
    @just test-env-down
```

## 5. In-depth, Step-by-Step Implementation Plan

We will follow the "Red-Green-Refactor" TDD workflow.

### Commit 1: RED — Write Failing Tests to Define Our Goal

This commit establishes our precise requirements through tests. The tests will fail initially because the implementation does not yet exist.

#### **Action 1: Update Existing Journal Test Expectations**

Modify `tests/integration/journals.test.ts`. The main success test must now assert that the created journal's `status` is `'PENDING'`.

```typescript
// file: tests/integration/journals.test.ts
// ... (imports and beforeEach/afterEach remain the same)

describe('POST /api/journals', () => {
  // ... (beforeEach, afterEach, afterAll setup)

  // ... (401 and 403 tests remain the same)

  it('should return 201 Created and status PENDING for a valid request', async () => {
    const res = await agent
      .post('/api/journals')
      .set('x-test-user-id', user1.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);
    // THIS IS THE NEW ASSERTION: We verify the initial state is PENDING.
    expect(res.body.journal.status).toBe('PENDING');
  });
});
```

#### **Action 2: Create the High-Fidelity Queue Integration Test**

This is the most important test. It requires a **running Redis server**. It gives us the highest confidence that our API correctly communicates with the queuing system.

Create a new file at `tests/integration/real-queue.test.ts` and implement it using the **correct, robust module loading pattern**.

```typescript
// file: tests/integration/real-queue.test.ts

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { PrismaClient, User } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis, { type Redis as RedisType, type RedisOptions } from 'ioredis';
import session from 'supertest-session';
import * as http from 'http';
import type { Express } from 'express';

// Use a unique queue name for this test to ensure isolation
const TEST_QUEUE_NAME = `test-real-queue-${Date.now()}`;

// This compatibility layer ensures `new Redis()` works correctly in an ESM/Jest environment.
const Redis = IORedis as unknown as { new (options: RedisOptions): RedisType };

const prisma = new PrismaClient();
let app: Express;
let server: http.Server;
let agent: session.Session;
let testUser: User;
let csrfToken: string;
let testQueue: Queue;
let testConnection: RedisType;

// This will hold the dynamically imported app factory function
let createApp: () => Express;

describe('API to Real Job Queue Integration', () => {
  // Increase the timeout because this test involves real network I/O to Docker.
  jest.setTimeout(20000);

  beforeAll(async () => {
    //
    // --- THIS IS THE CRITICAL TEST SETUP PATTERN ---
    //
    // 1. Clear Jest's module cache. This is essential to allow us to re-import
    //    the application with our test-specific environment variables.
    jest.resetModules();

    // 2. Override the environment variable *before* the application code is imported.
    process.env.QUEUE_NAME = TEST_QUEUE_NAME;

    // 3. Dynamically import the app factory function *after* setting the env var.
    //    This guarantees that when src/lib/queue.ts is loaded for the first time,
    //    it will use our unique TEST_QUEUE_NAME.
    const appModule = await import('../../src/index.js');
    createApp = appModule.createApp;

    // --- Standard Test Setup Resumes ---

    // Setup a direct Redis connection for test verification
    testConnection = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT!, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB!, 10),
      maxRetriesPerRequest: null,
    });
    testQueue = new Queue(TEST_QUEUE_NAME, { connection: testConnection });
    await testQueue.obliterate({ force: true }); // Clear the queue

    // Setup Application Server
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    agent = session(app);

    // Setup Database and User
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: {
        email: `real-queue-test-${Date.now()}@example.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://real-queue.ns.com',
      },
    });

    // Fetch CSRF Token
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  afterAll(async () => {
    // Gracefully shut down all connections and the server
    if (testQueue) await testQueue.close();
    if (testConnection) testConnection.disconnect();
    if (prisma) {
      await prisma.journal.deleteMany({});
      await prisma.user.deleteMany({});
      await prisma.$disconnect();
    }
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  });

  it('POST /api/journals should create a journal and enqueue a job in the real Redis queue', async () => {
    // Act: Call the API endpoint
    const response = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(201);
    const journalId = response.body.journal.id;
    expect(journalId).toBeDefined();

    // Assert: Check the REAL Redis queue for the job
    const jobs = await testQueue.getJobs(['waiting']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.journalId).toBe(journalId);
    expect(jobs[0].name).toBe('process-journal');
  });
});
```

#### **Action 3: Verify Failure and Commit**

Run the tests. They will fail as expected. This is our "RED" state.

```bash
# In one terminal, start the Redis container
just test-env-up

# In another terminal, run the tests
just test

# When you are done, stop the Redis container
just test-env-down

# Now, commit the failing tests
git add .
git commit -m "test(api): add failing tests for job queuing on journal creation"
```

---

### Commit 2: GREEN — Implement the Feature and Make Tests Pass

This commit introduces all the necessary code to implement the job queue system.

#### **Action 1: Define Services with Docker Compose**

The existing `docker-compose.yml` is excellent. We will use it as-is.

```yaml
# file: goodnumbers/docker-compose.yml
# This file is already correct.

version: '3.8'

services:
  redis:
    image: redis/redis-stack-server:latest
    container_name: goodnumbers-redis
    command: redis-stack-server --requirepass ${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    ports:
      # Securely bind to localhost only
      - '127.0.0.1:6379:6379'
    volumes:
      - redis-data:/data
# ... (rest of file)
```

#### **Action 2: Install Dependencies**

```bash
cd goodnumbers
npm install bullmq ioredis
npm install --save-dev pm2
```

#### **Action 3: Update Environment Configuration**

Add the Redis and Queue configuration to your `.env.example` and `.env.test` files.

```bash
# file: goodnumbers/.env.example

# ... existing variables ...

# --- Background Job Queue (Redis) ---
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=a-very-secure-and-long-password-for-local-dev
REDIS_DB=0
QUEUE_NAME=journal-processing
```

```bash
# file: goodnumbers/.env.test

# ... existing variables

# --- Redis for Testing ---
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=a-very-secure-and-long-password-for-local-dev
# CRITICAL: Use a separate DB for test isolation to prevent tests from
# wiping development data.
REDIS_DB=1
# A default queue name for tests that don't override it.
QUEUE_NAME=journal-processing-test
```

#### **Action 4: Create the Queue Singleton Module**

This module will manage the connection to Redis and the queue instance.

```typescript
// file: src/lib/queue.ts

import { Queue } from 'bullmq';
import IORedis, { type Redis as RedisType, type RedisOptions } from 'ioredis';

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error('FATAL: Redis connection variables are not set.');
}

// This compatibility layer is essential for using ioredis with ESM and Jest.
const Redis = IORedis as unknown as { new (options: RedisOptions): RedisType };

// The queue name is read from the environment. This is what our test hijacks.
export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || 'journal-processing';

// This connection is created ONCE when the module is first loaded.
export const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  // This is important for robustness; BullMQ handles retries.
  maxRetriesPerRequest: null,
});

connection.on('error', (err: Error) => {
  console.error('[FATAL] Redis connection error:', err);
});

console.log(
  `[QUEUE_SETUP] BullMQ is connecting to queue: '${JOURNAL_QUEUE_NAME}'`,
);

// The singleton queue instance.
export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, {
  connection,
});
```

#### **Action 5: Modify the Journal Creation Endpoint**

Update `src/routes/journal.ts` to add jobs to the queue and include the robust rollback logic.

```typescript
// file: src/routes/journal.ts

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { journalQueue } from '../lib/queue.js'; // Import the queue

const router = Router();

// Change: The entire route is now wrapped in a try/catch with rollback logic.
router.post('/', async (req, res, next) => {
  const userId = req.user!.id;
  let journal; // Declare journal outside the try block for access in catch

  try {
    // 1. Create the journal with PENDING status.
    journal = await prisma.journal.create({
      data: {
        userId,
        status: 'PENDING', // This now passes the test from Action 1
      },
    });

    // 2. Enqueue the job for the worker.
    await journalQueue.add('process-journal', {
      journalId: journal.id,
    });

    res.status(201).json({ journal });
  } catch (error) {
    // 3. THIS IS THE CRITICAL ROLLBACK LOGIC.
    // If enqueueing the job fails, we must delete the journal we just created
    // to prevent it from being orphaned in the database forever.
    if (journal) {
      console.error(
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back journal creation.`,
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }
    // Pass the original error to the global error handler.
    next(error);
  }
});

export default router;
```

#### **Action 6: Create the Skeleton Worker**

This is the separate process that will consume the jobs.

```typescript
// file: src/worker.ts

import './lib/env.js';
import { Worker } from 'bullmq';
import IORedis, { type Redis as RedisType, type RedisOptions } from 'ioredis';
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';

console.log('[Worker] Starting up...');

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error('FATAL: Redis connection variables are not set for worker.');
}

const Redis = IORedis as unknown as { new (options: RedisOptions): RedisType };

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT as string, 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  JOURNAL_QUEUE_NAME,
  async (job) => {
    // This is where the heavy lifting will go in a future task.
    // For now, we just log that we received the job.
    console.log(
      `[Worker] Processing job ${job.id} (Journal ID: ${job.data.journalId})`,
    );
    // Simulate work.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`[Worker] Finished job ${job.id}`);
    return { status: 'done', journalId: job.data.journalId };
  },
  { connection },
);

// --- Event Listeners for Monitoring ---
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(
    `[Worker] Job ${job?.id} has failed with error: ${err.message}`,
  );
});

// --- Graceful Shutdown ---
// This is critical to prevent a job from being interrupted halfway through.
// `worker.close()` will wait for the current job to finish before exiting.
const closeGracefully = async () => {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  connection.disconnect();
  process.exit(0);
};

process.on('SIGTERM', closeGracefully); // Standard shutdown signal
process.on('SIGINT', closeGracefully); // Ctrl+C

console.log(
  `[Worker] Worker listening for jobs on "${JOURNAL_QUEUE_NAME}" queue...`,
);
```

#### **Action 7: Create PM2 Ecosystem Configuration**

This file tells our process manager, PM2, how to run our two-process application.

```javascript
// file: goodnumbers/ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'goodnumbers-web',
      script: './dist/index.js',
      instances: 1,
      // Cluster mode is good for stateless HTTP servers.
      exec_mode: 'cluster',
      watch: ['./dist'],
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
    {
      name: 'goodnumbers-worker',
      script: './dist/worker.js',
      instances: 1,
      // Fork mode is required for background workers.
      exec_mode: 'fork',
      watch: ['./dist'],
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
  ],
};
```

#### **Action 8: Add/Update Scripts in `package.json`**

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

#### **Action 9: Verify Success and Commit**

1.  **Run automated tests.** Ensure Docker is running. All tests should now pass. This is our "GREEN" state.
    ```bash
    just test-ci
    ```
2.  **Manually test the full flow:**
    1.  Run `just run` in your terminal.
    2.  Run `just logs` in another terminal to watch both the server and worker.
    3.  Trigger the `POST /api/journals` endpoint (e.g., using `curl`, Postman, or by wiring it up to a temporary button in the UI).
    4.  Observe the logs: the API log should appear instantly, and a few moments later, the `[Worker] Processing job...` log should appear.
3.  **Commit the work.**
    ```bash
    git add .
    git commit -m "feat(worker): integrate bullmq for background job processing"
    ```

## 6. Conclusion

Congratulations. By completing this task, you have implemented one of the most critical and scalable pieces of our backend infrastructure. You have also mastered an advanced testing technique for ensuring Node.js applications can be reliably tested, even when they rely on module-level singletons. This foundation will serve us well as we continue to build out the application's features.
