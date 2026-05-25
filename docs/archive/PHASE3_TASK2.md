# Goodnumbers — PHASE 3, TASK 2: Implement Asynchronous Job Queue

**Version:** 3.5 (Correcting Integration Test Instantiation)
**Author:** Technical Lead
**Date:** 2025-09-28
**Status:** Approved for Implementation

## 1. Overview & Purpose (The "Why")

The Goodnumbers journal generation process involves long-running tasks, including external API calls to Nightscout, statistical analysis, a multi-pass AI pipeline with Gemini, and audio generation via a TTS service. Executing these tasks within a synchronous API request is not feasible; it would lead to request timeouts, a poor user experience, and a fragile system.

To solve this, we are implementing an **asynchronous job queue**. This architecture decouples the initial user request from the intensive background work. The API's only responsibility is to acknowledge the request and schedule the work, ensuring a fast, responsive user experience. The background work is then processed reliably and independently by a separate worker process.

This document serves as the complete, definitive guide to this system, intended for any engineer who needs to understand, implement, or maintain this critical piece of our infrastructure.

## 2. Architecture & Technology Selection

Our system is composed of three primary components arranged in a producer/consumer pattern:

- **The Producer (`src/routes/journal.ts`):** The API endpoint (`POST /api/journals`) that adds a `process-journal` job to the queue after successfully creating a `Journal` record in the database.
- **The Queue (`src/lib/queue.ts`):** A shared module that configures the connection to a message broker and instantiates the job queue.
- **The Consumer (`src/worker.ts`):** A standalone Node.js process that listens for jobs on the queue and executes the long-running journal generation logic.

### 2.1. Technology Stack

- **Redis:** A high-performance, in-memory data store acting as our message broker. It is reliable, fast, and feature-rich.
- **IORedis:** A robust and efficient Node.js client for Redis.
- **BullMQ:** A modern job queue library for Node.js built on top of Redis, providing reliability, performance, and advanced features.
- **Docker Compose:** A tool for defining and running multi-container Docker applications. We will use it to manage our Redis service in development, ensuring a consistent environment for all team members.
- **PM2:** A production-grade process manager for Node.js applications. We will use it to manage both our web server and worker processes, enabling features like automatic restarts and log aggregation.
- **Just:** A command runner that provides a simple, consistent interface for common development tasks, orchestrating Docker Compose, NPM scripts, and PM2.

## 3. Developer Environment Setup

This section provides a complete guide to setting up the local development environment. By using `just`, we have simplified the entire process into a few memorable commands.

### 3.1. Prerequisites

1.  **Node.js:** Ensure you have Node.js v18 or later installed.
2.  **Docker:** Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running.
3.  **Just:** Install the `just` command runner.
    - On macOS with Homebrew: `brew install just`
    - For other systems, see the [official installation instructions](https://github.com/casey/just#installation).

### 3.2. First-Time Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Setup Environment Variables:**
    Copy the environment variable template. You will need to fill in your `AUTH_*` secrets. The `REDIS_*` variables are now configured with a default password for enhanced local security.
    ```bash
    cp .env.example .env
    ```
3.  **Run Database Migrations:**
    This command sets up your local SQLite database based on the Prisma schema.
    ```bash
    npx prisma migrate dev
    ```

### 3.3. Daily Workflow Commands

- **To start everything (Redis, web server, worker):**
  ```bash
  just run
  ```
- **To view logs from both the server and worker:**
  ```bash
  just logs
  ```
- **To stop everything and clean up:**
  ```bash
  just clean
  ```

## 4. In-depth, Step-by-Step Implementation Plan

We will follow a Test-Driven Development (TDD) "Red-Green-Refactor" workflow.

### Commit 1: RED — Write Failing Tests for the New Queuing Logic

This commit establishes our precise requirements through tests. The tests will fail initially because the implementation does not yet exist.

#### **Action 1: Update Existing Journal Test Expectations**

Modify `tests/integration/journals.test.ts`. The main success test must now also assert that the created journal's `status` is `'PENDING'`. We will also update the test setup to use modern `async/await` for better stability.

```typescript
// file: tests/integration/journals.test.ts

import session from "supertest-session";
import * as http from "http";
import { PrismaClient, User } from "@prisma/client";
import type { Express } from "express";
import { createApp } from "../../src/index";

const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
let agent: session.Session;
let user1: User;
let csrfToken: string;

describe("POST /api/journals", () => {
  beforeEach(async () => {
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    agent = session(app);

    await prisma.user.deleteMany();
    user1 = await prisma.user.create({
      data: {
        email: `user1-${Date.now()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: "https://user1.ns.com",
      },
    });

    const csrfRes = await agent.get("/api/csrf-token");
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should return 401 Unauthorized if no user is authenticated", async () => {
    const res = await agent.post("/api/journals").send({ _csrf: csrfToken });
    expect(res.status).toBe(401);
  });

  it("should return 403 Forbidden if the CSRF token is missing", async () => {
    const res = await agent
      .post("/api/journals")
      .set("x-test-user-id", user1.id)
      .send({}); // No '_csrf' field
    expect(res.status).toBe(403);
  });

  it("should return 201 Created and status PENDING for a valid request", async () => {
    const res = await agent
      .post("/api/journals")
      .set("x-test-user-id", user1.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);
    // This is the new assertion that will fail initially.
    expect(res.body.journal.status).toBe("PENDING");
  });
});
```

#### **Action 2: Create the High-Fidelity Queue Integration Test**

This is a true integration test that verifies the entire system. It requires a **running Redis server** (which `docker-compose.yml` will provide). This test gives us the highest confidence that our API correctly communicates with the queuing system.

Create a new file at `tests/integration/real-queue.test.ts`.

```typescript
// file: tests/integration/real-queue.test.ts

import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { PrismaClient, User } from "@prisma/client";
import { Queue } from "bullmq";
// FIX: This is the robust way to import ioredis in an ESM/Jest environment
import IORedis, { type Redis as RedisType, type RedisOptions } from "ioredis";
import session from "supertest-session";
import * as http from "http";
import type { Express } from "express";
import { createApp } from "../../src/index.js";

// Use a unique queue name for this test to ensure isolation
const TEST_QUEUE_NAME = `test-real-queue-${Date.now()}`;
// Override the environment variable *before* the app is created
process.env.QUEUE_NAME = TEST_QUEUE_NAME;

// FIX: This compatibility layer ensures `new Redis()` works correctly.
const Redis = IORedis as unknown as { new (options: RedisOptions): RedisType };

const prisma = new PrismaClient();
let app: Express;
let server: http.Server;
let agent: session.Session;
let testUser: User;
let csrfToken: string;
let testQueue: Queue;
let testConnection: RedisType;

describe("API to Real Job Queue Integration", () => {
  // Increase the timeout for this suite, as it involves real network I/O.
  jest.setTimeout(20000);

  beforeAll(async () => {
    // --- Setup Redis Connection for Test Verification ---
    testConnection = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT!, 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB!, 10),
      maxRetriesPerRequest: null,
    });
    testQueue = new Queue(TEST_QUEUE_NAME, { connection: testConnection });
    await testQueue.obliterate({ force: true }); // Clear the queue

    // --- Setup Application Server ---
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    agent = session(app);

    // --- Setup Database and User ---
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: {
        email: `real-queue-test-${Date.now()}@example.com`,
        agreementsSigned: true,
        nightscoutUrl: "https://real-queue.ns.com",
      },
    });

    // --- Fetch CSRF Token ---
    const tokenRes = await agent.get("/api/csrf-token");
    csrfToken = tokenRes.body.csrfToken;
  });

  afterAll(async () => {
    // --- FIX: More Robust Graceful Teardown ---
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

  it("POST /api/journals should create a journal and enqueue a job in the real Redis queue", async () => {
    // Act: Call the API endpoint
    const response = await agent
      .post("/api/journals")
      .set("x-test-user-id", testUser.id)
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(201);
    const journalId = response.body.journal.id;
    expect(journalId).toBeDefined();

    // Assert: Check the REAL Redis queue for the job
    const jobs = await testQueue.getJobs(["waiting"]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.journalId).toBe(journalId);
    expect(jobs[0].name).toBe("process-journal");
  });
});
```

#### **Action 3: Verify Failure and Commit**

Run the tests. They will fail as expected because the `PENDING` status and queueing logic haven't been implemented. This is our "RED" state.

```bash
# You must have Docker running for this test to connect to Redis
cd goodnumbers
# You can spin up just the redis container for testing
docker-compose up -d redis
npm test
git add .
git commit -m "test(api): add failing tests for job queuing on journal creation"
```

---

### Commit 2: GREEN — Implement the Feature and Make Tests Pass

This commit introduces all the necessary code to implement the job queue system.

#### **Action 1: Define Services with Docker Compose**

Create `docker-compose.yml`.

```yaml
# file: goodnumbers/docker-compose.yml

version: "3.8"

services:
  redis:
    image: redis/redis-stack-server:latest
    container_name: goodnumbers-redis
    command: redis-stack-server --requirepass ${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - goodnumbers-net

volumes:
  redis-data:
    driver: local

networks:
  goodnumbers-net:
    driver: bridge
```

#### **Action 2: Install Dependencies**

```bash
cd goodnumbers
npm install bullmq ioredis
npm install --save-dev pm2
```

#### **Action 3: Update Environment Configuration**

Update `.env.example` and `.env.test`.

```bash
# file: goodnumbers/.env.example

# ... existing variables ...

# --- Background Job Queue (Redis) ---
# Connection details for the Redis server backing the job queue
# SECURITY: A default password is provided. For a real production system,
# this should be replaced with a securely generated secret.
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=a-very-secure-and-long-password-for-local-dev
REDIS_DB=0
QUEUE_NAME=journal-processing

NODE_ENV=development
```

```bash
# file: goodnumbers/.env.test

# ... existing variables

# Redis connection for testing
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=a-very-secure-and-long-password-for-local-dev
REDIS_DB=1 # Use a separate DB for test isolation
QUEUE_NAME=journal-processing-test # Use a separate queue for test isolation
```

#### **Action 4: Create the Production-Grade Queue Singleton**

```typescript
// file: goodnumbers/src/lib/queue.ts

import { Queue } from "bullmq";
import IORedis, { type Redis as RedisType, type RedisOptions } from "ioredis";

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error("FATAL: Redis connection variables are not set.");
}

const Redis = IORedis as unknown as { new (options: RedisOptions): RedisType };

export const JOURNAL_QUEUE_NAME =
  process.env.QUEUE_NAME || "journal-processing";

export const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null,
});

connection.on("error", (err: Error) => {
  console.error("[FATAL] Redis connection error:", err);
});

console.log(
  `[QUEUE_SETUP] BullMQ is connecting to queue: '${JOURNAL_QUEUE_NAME}'`,
);

export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, {
  connection,
});

const closeConnection = async () => {
  console.log("[Queue] Closing Redis connections...");
  await journalQueue.close();
  connection.disconnect();
};

process.on("SIGTERM", closeConnection);
process.on("SIGINT", closeConnection);
```

#### **Action 5: Modify the Journal Creation Endpoint**

```typescript
// file: goodnumbers/src/routes/journal.ts

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { journalQueue } from "../lib/queue.js";

const router = Router();

router.post("/", async (req, res, next) => {
  const userId = req.user!.id;
  let journal;

  try {
    journal = await prisma.journal.create({
      data: {
        userId,
        status: "PENDING",
      },
    });

    await journalQueue.add("process-journal", {
      journalId: journal.id,
    });

    res.status(201).json({ journal });
  } catch (error) {
    if (journal) {
      console.error(
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back journal creation.`,
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }
    next(error);
  }
});

export default router;
```

#### **Action 6: Create the Skeleton Worker**

```typescript
// file: goodnumbers/src/worker.ts

import "./lib/env.js";
import { Worker } from "bullmq";
import IORedis, { type Redis as RedisType, type RedisOptions } from "ioredis";
import { JOURNAL_QUEUE_NAME } from "./lib/queue.js";

console.log("[Worker] Starting up...");

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error("FATAL: Redis connection variables are not set for worker.");
}

const Redis = IORedis as unknown as { new (options: RedisOptions): RedisType };

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT as string, 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  JOURNAL_QUEUE_NAME,
  async (job) => {
    console.log(
      `[Worker] Processing job ${job.id} (Journal ID: ${job.data.journalId})`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`[Worker] Finished job ${job.id}`);
    return { status: "done", journalId: job.data.journalId };
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} has completed successfully.`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[Worker] Job ${job?.id} has failed with error: ${err.message}`,
  );
});

const closeGracefully = async () => {
  console.log("[Worker] Shutting down gracefully...");
  await worker.close();
  connection.disconnect();
  process.exit(0);
};

process.on("SIGTERM", closeGracefully);
process.on("SIGINT", closeGracefully);

console.log(
  `[Worker] Worker listening for jobs on "${JOURNAL_QUEUE_NAME}" queue...`,
);
```

#### **Action 7: Create PM2 Ecosystem Configuration**

```javascript
// file: goodnumbers/ecosystem.config.cjs

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

#### **Action 8: Add/Update Scripts in `package.json`**

```json
// file: goodnumbers/package.json
{
  "name": "goodnumbers",
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

#### **Action 9: Create Justfile for Simplified Workflow**

```makefile
# file: goodnumbers/justfile

# --- SERVICE MANAGEMENT ---
services-up:
    @echo "Starting Redis container..."
    @docker-compose up -d

services-down:
    @echo "Stopping and removing Redis container..."
    @docker-compose down

# --- APPLICATION MANAGEMENT ---
build:
    @npm run build

dev:
    @npm run dev

stop:
    @npm run stop

logs:
    @npm run logs

# --- COMBINED WORKFLOWS ---
run: build services-up dev

# --- UTILITIES ---
clean: stop services-down
    @echo "Removing node_modules..."
    @rm -rf node_modules
```

#### **Action 10: Update Project `README.md`**

````markdown
# file: goodnumbers/README.md

## Local Development Setup

### Prerequisites

1.  **Node.js** (v18 or later)
2.  **Docker**
3.  **Just** (a command runner, e.g., `brew install just`)

### Running the Application

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Setup Environment Variables:**
    Copy `.env.example` to `.env` and fill in the required `AUTH_*` secrets.

    ```bash
    cp .env.example .env
    ```

3.  **Run Database Migrations:**

    ```bash
    npx prisma migrate dev
    ```

4.  **Build, Start Services, and Run App:**

    ```bash
    just run
    ```

5.  **View Logs:**
    ```bash
    just logs
    ```

### Stopping the Application

```bash
just clean
```
````

#### **Action 11: Verify Success and Commit**

1.  **Run automated tests.** Ensure Docker is running. All tests should now pass. This is our "GREEN" state.
    ```bash
    cd goodnumbers
    npm test
    ```
2.  **Manually test the full flow using the new commands:**
    1.  Run `just run` in your terminal.
    2.  Run `just logs` in another terminal.
    3.  Trigger the `POST /api/journals` endpoint using a tool like `curl` or Postman.
    4.  Observe the logs to confirm the API returns quickly and the worker log (`[Worker] Processing job...`) appears shortly after.
3.  **Commit the work.**
    ```bash
    git add .
    git commit -m "feat(worker): P3_T2 integrate bullmq for background job processing"
    ```
