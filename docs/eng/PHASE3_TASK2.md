# Engineering Guide: Implementing True Integration Tests for Redis & BullMQ (Revised)

**Author:** Senior Software & Security Expert
**Status:** Ready for Implementation

## 1. Overview & Goal

This document provides a detailed, step-by-step guide to implementing "true" integration tests for our BullMQ and Redis infrastructure.

Our current test suite for the job queue (`queue.test.ts`) uses mocking. This is an excellent and important testing strategy. It allows us to run tests that are fast, isolated, and deterministic. These tests verify the *contract* between our API controller and the queueing library—that is, they confirm that the `POST /api/journals` endpoint calls the correct queueing function with the correct data.

However, these tests cannot verify several critical, real-world behaviors:

1.  **Network Connectivity:** Can our application actually connect to the Redis server using the provided credentials?
2.  **Data Serialization:** Does the job data get correctly serialized and stored in Redis without corruption?
3.  **End-to-End Flow:** Does the job placed in the queue by the API server actually become visible to a separate process (like our worker)?

The goal of this task is to create a new test suite that runs against a **real, live Redis instance** (provided by our Docker Compose environment) to gain complete confidence in our background job processing pipeline.

## 2. The Core Challenge: Testing the *Application's* Queue

The conceptual example provided (`real-queue.test.ts`) had a very insightful idea: connect to a real Redis instance in the test. However, it contained a subtle but critical flaw in its approach.

The example code created a *new, separate* BullMQ instance inside the test file that pointed to a unique test queue (`real-journal-queue-${Date.now()}`). It then made an API call and checked *that* queue for a job. The problem is that our Express application, when it runs, creates its *own* queue instance inside `src/lib/queue.ts`, and it will **always** send jobs to the queue named `journal-generation` unless we tell it otherwise.

**The Solution: Environment-Driven Configuration**

The correct approach is to make the application's queue name configurable, and then have our test suite control that configuration. We will use an environment variable to achieve this. This allows our test to tell the running application, "For this test run, send jobs to this specific, isolated queue name." The test will then connect to the same Redis instance and inspect that exact same queue.

This approach allows us to test the **actual application code path** without any mocks, while maintaining perfect isolation between test runs and from the development environment.

## 3. Step-by-Step Implementation Guide

### Step 3.1: Make the Queue Library Testable

First, we need to modify our queue library to respect an environment variable for the queue name. This is a small, safe change that makes our code much more testable.

Update the `goodnumbers/src/lib/queue.ts` file to use `process.env.QUEUE_NAME` if it exists, otherwise falling back to the default name.

```typescript
// file: goodnumbers-workspace/goodnumbers/src/lib/queue.ts
import { Queue } from "bullmq";
import Redis from "ioredis";

// Define the name of our queue.
// BEST PRACTICE: Allow the queue name to be overridden by an environment variable.
// This is the key to creating isolated, parallel-safe integration tests.
// If the environment variable is not set, it defaults to the production/development name.
export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || "journal-generation";

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

// Log which queue is being used. This is very helpful for debugging tests.
console.log(`[QUEUE_SETUP] BullMQ is connecting to queue: '${JOURNAL_QUEUE_NAME}'`);

// Create and export the BullMQ queue instance. This will be imported by our
// API server to add jobs.
export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, { connection });
```

### Step 3.2: Create the New Integration Test File

Now, create a new test file. This file will contain the "true" integration test that connects to the real Redis service running in Docker.

#### **Critical Prerequisite: Environment Setup**

Before running this test, you must ensure two things are set up correctly:

1.  **Docker is Running:** The Redis service must be active. You can start it in a separate terminal with `cd goodnumbers && docker-compose up`.
2.  **`.env` File is Configured:** Your `goodnumbers/.env` file must exist and contain the correct values for `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`, matching what is configured in `docker-compose.yml` and `.env.example`.

```typescript
// file: goodnumbers-workspace/goodnumbers/tests/integration/real-queue.test.ts
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import supertest from 'supertest';
import { createId } from '@paralleldrive/cuid2';
import type { User } from '@prisma/client';

import app from '../../src/index';
import { prisma } from '../../src/db';

// --- Test Setup: Isolated Queue Configuration ---
// 1. Generate a unique queue name for this specific test file run.
//    This prevents collisions with other running tests or a local dev server.
const TEST_QUEUE_NAME = `test-real-journal-queue-${createId()}`;

// 2. Set the environment variable BEFORE the application code (especially src/lib/queue.ts) is imported.
//    Jest will automatically hoist this `process.env` assignment, ensuring that when `app` is imported,
//    it will create a BullMQ instance that uses our unique test queue name.
process.env.QUEUE_NAME = TEST_QUEUE_NAME;

describe('BullMQ True Integration with Real Redis', () => {
  let realTestQueue: Queue;
  let redisConnection: Redis;
  let testUser: User;
  let agent: supertest.SuperAgentTest;
  let csrfToken: string;

  // -- Test Lifecycle: Setup --
  beforeAll(async () => {
    // 1. Establish a direct connection to the REAL Redis instance.
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });
    redisConnection.on('error', (err) => {
      console.error('[TEST_REDIS] Test Redis connection error:', err);
      throw err; // Fail fast if we can't connect to Redis
    });

    // 2. Create a BullMQ Queue instance in our test.
    realTestQueue = new Queue(TEST_QUEUE_NAME, { connection: redisConnection });

    // 3. Prepare the database state.
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: { email: `real-queue-test-${createId()}@example.com` },
    });

    // 4. Prepare the HTTP agent and get a CSRF token.
    agent = supertest.agent(app);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;

    console.log(`[TEST_SETUP] Real Redis test setup complete. Using isolated queue: ${TEST_QUEUE_NAME}`);
  }, 20000);

  // -- Test Lifecycle: Teardown --
  afterEach(async () => {
    await realTestQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await realTestQueue.close();
    await redisConnection.quit();
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
    console.log('[TEST_TEARDOWN] Real Redis test teardown complete.');
  });

  // --- Test Cases ---

  it('should successfully connect to the Redis server and receive a PONG', async () => {
    // This is a direct "health check" to confirm the fundamental connection is working.
    const response = await redisConnection.ping();
    expect(response).toBe('PONG');
  });

  it('POST /api/journals should enqueue a job in the REAL Redis-backed BullMQ queue', async () => {
    // Act:
    const response = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken)
      .send({});

    // Assert (Part 1): The API should respond correctly.
    expect(response.status).toBe(201);
    const journalId = response.body.id;
    expect(journalId).toBeDefined();

    // Assert (Part 2): The job should exist in the real Redis queue.
    const jobs = await realTestQueue.getJobs(['waiting']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.journalId).toBe(journalId);
    expect(jobs[0].name).toBe('generate-journal');
  });
});
```

### Step 3.3: Update Project Documentation

To ensure this new testing layer is understood and maintained, add a new section to the `IMPLEMENTATION_PLAN.md` document, which outlines the project's testing strategy.

```markdown
// file: goodnumbers-workspace/docs/IMPLEMENTATION_PLAN.md
# (This is an addition to the existing file. Find section 2.2 and add this new sub-section.)

### 2.2. Levels of Testing & Tooling
... (existing content) ...

#### 2.2.1. A Two-Tier Approach to Integration Testing

For services that interact with external dependencies like a database or a Redis queue, we will adopt a two-tier integration testing strategy to balance speed and confidence:

1.  **Tier 1: Mocked Integration Tests (Fast Feedback)**
    -   **Purpose:** To verify the application's internal logic and the "contract" between different parts of our code. For example, ensuring an API route correctly calls a specific function from our queue library.
    -   **Mechanism:** We use Jest's mocking capabilities (`jest.unstable_mockModule`) to replace the real external dependency with a controlled, in-memory version.
    -   **Characteristics:** These tests are extremely fast, reliable, and can run in parallel without interfering with each other. They are ideal for running frequently during local development.
    -   **Example:** `tests/integration/queue.test.ts`

2.  **Tier 2: "True" Integration Tests (High Confidence)**
    -   **Purpose:** To verify the application's ability to correctly connect to, serialize data for, and interact with a real backing service (e.g., the Redis server running in Docker).
    -   **Mechanism:** These tests run against a live service. They use environment variables to configure the application to use a unique, isolated namespace (like a specific queue name) for the duration of the test run.
    -   **Characteristics:** These tests are slower and require the external dependency to be running. They provide the highest level of confidence that the entire integrated system works as expected. They are critical for our CI/CD pipeline before a deployment.
    -   **Example:** `tests/integration/real-queue.test.ts`

... (rest of the document) ...
```

## 4. Scope and Final Considerations

This guide and the tests it produces are intentionally focused on the current phase of the project.

-   **Test Scope:** The `real-queue.test.ts` suite verifies the flow from an **API request to a job successfully landing in the Redis queue**. It correctly **does not** test the worker's ability to process the job. That is a separate concern that will be tested in a future task when the worker's logic is implemented.
-   **Running the Tests:** Make sure your Docker Redis container is running before executing `npm test -- tests/integration/real-queue.test.ts`. This test will fail if it cannot connect to the Redis service.

By implementing these changes, you will have a robust, two-layered testing strategy that provides both rapid feedback during development and high confidence in the stability of your production deployments.