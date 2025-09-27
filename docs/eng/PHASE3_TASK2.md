Excellent. It is a mark of a great engineering team to be proactive about hardening designs. Adopting these security and reliability improvements early will pay significant dividends in the long run.

I have updated the design and implementation guide to incorporate all the requested changes. I have been extremely detailed in the explanations, providing context and rationale for each modification to ensure it serves as a valuable learning document for the junior engineer.

Below is the complete, updated design guide, which now includes the enhanced security and reliability patterns we discussed.

---

# file: docs/eng/DESIGN_GUIDE_JOB_QUEUE.md

# Goodnumbers — Engineering Design & Implementation Guide: Asynchronous Job Queue

**Version:** 3.1 (Security Hardened Edition)
**Author:** Technical Lead
**Date:** 2025-09-27
**Status:** Final

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

Modify `tests/integration/journals.test.ts`. The main success test must now also assert that the created journal's `status` is `'PENDING'`.

```typescript
// file: tests/integration/journals.test.ts

import session from "supertest-session";
import * as http from "http";
import { PrismaClient, User } from "@prisma/client";
import type { Express } from "express";
import { createApp } from "../../src/index.js";

const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
let agent: session.Session;
let user1: User;
let csrfToken: string;

describe("POST /api/journals", () => {
  beforeEach((done) => {
    app = createApp();
    server = app.listen(0, async () => {
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

      done();
    });
  });

  afterEach((done) => {
    server.close(done);
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

#### **Action 2: Create the Mocked Queue Integration Test**

Create a new file to test the interaction between the API and the queue, using a mock to ensure the test is fast and isolated.

````typescript
// file: tests/integration/queue.test.ts

import session from "supertest-session";
import * as http from "http";
import { PrismaClient, User } from "@prisma/client";
import type { Express } from "express";
import { jest } from "@jest/globals";

// MOCKING STRATEGY: Replace our real queue module with a mock.
const mockQueueAdd = jest.fn();
jest.unstable_mockModule("../../src/lib/queue.js", () => ({
  journalProcessingQueue: {
    add: mockQueueAdd,
    close: jest.fn().mockResolvedValue(undefined),
  },
}));

const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
let agent: session.Session;
let user1: User;
let csrfToken: string;

describe("POST /api/journals Job Queuing", () => {
  beforeEach(async () => {
    // CRITICAL: Reset modules before each test to ensure the mock is used
    // by the newly imported application code.
    jest.resetModules();
    mockQueueAdd.mockClear();

    // Dynamically import the app factory *after* resetting modules.
    const { createApp } = await import("../../src/index.js");

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

    // Assert that our mock function was called correctly
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith("process-journal", {
      journalId: journalId,
    });
  });
});```

#### **Action 3: Verify Failure and Commit**

Run the tests. They will fail as expected. Commit this "RED" state to version control.

```bash
cd goodnumbers
npm test
git add .
git commit -m "test(api): add failing tests for job queuing on journal creation"
````

---

### Commit 2: GREEN — Implement the Feature and Make Tests Pass

This commit introduces all the necessary code to implement the job queue system.

#### **Action 1: Define Services with Docker Compose**

Create `docker-compose.yml`. We will add a `command` to set a default password. This password will be passed in via an environment variable, which Docker Compose can read from our `.env` file. This is a critical security practice, even for local development.

```yaml
# file: goodnumbers/docker-compose.yml

version: "3.8"

# Defines the external services needed for development.
# Run `just services-up` to start and `just services-down` to stop.
services:
  redis:
    image: redis/redis-stack-server:latest
    container_name: goodnumbers-redis
    # SECURITY: We add a command to start Redis with a required password.
    # The password is read from the .env file via the 'environment' key.
    command: redis-stack-server --requirepass ${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379" # Bind to localhost only for security
    volumes:
      - redis-data:/data # Persist Redis data across restarts
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

Install `bullmq`, the Redis client `ioredis`, and `pm2` for process management.

```bash
cd goodnumbers
npm install bullmq ioredis
npm install --save-dev pm2
```

#### **Action 3: Update Environment Configuration**

Add Redis connection variables to your environment files, including the new `REDIS_PASSWORD`. We provide a secure default password in the example file.

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
```

#### **Action 4: Create the Queue Singleton**

Create a reusable module to manage the BullMQ connection, ensuring it now uses the `REDIS_PASSWORD` environment variable.

```typescript
// file: goodnumbers/src/lib/queue.ts

import { Queue } from "bullmq";
import { Redis } from "ioredis";

// --- Fatal Error Checks ---
if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error("FATAL: Redis connection variables are not set.");
}

// Establish a reusable connection to Redis.
const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT as string, 10),
  // SECURITY: Use the password from the environment variables.
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null, // Required by BullMQ for reliability
  // PRODUCTION NOTE: For a real production deployment where Redis is on a
  // separate machine, you would need to enable TLS here for security.
  // Example: tls: { servername: process.env.REDIS_HOST }
});

// Create and export the queue instance. The queue name is configurable
// via environment variables, which is crucial for test isolation.
export const journalProcessingQueue = new Queue(
  process.env.QUEUE_NAME || "journal-processing",
  {
    connection,
  }
);

// Graceful shutdown logic is critical to prevent orphaned connections
// or jobs being dropped during deployments or restarts.
const closeConnection = async () => {
  console.log("[Queue] Closing Redis connections...");
  await journalProcessingQueue.close();
  connection.disconnect();
};

process.on("SIGTERM", closeConnection);
process.on("SIGINT", closeConnection);
```

#### **Action 5: Modify the Journal Creation Endpoint**

Update the route handler to set the `PENDING` status and enqueue the job. We will add a crucial improvement here: a "compensating transaction" pattern. If enqueuing the job fails, we will attempt to delete the journal record we just created to prevent it from getting stuck in a "PENDING" state forever. This makes our system more resilient.

```typescript
// file: goodnumbers/src/routes/journal.ts

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { journalProcessingQueue } from "../lib/queue.js";

const router = Router();

router.post("/", async (req, res, next) => {
  const userId = req.user!.id;
  let journal; // Declare journal here to access it in the catch block

  try {
    // 1. Create the journal with a PENDING status.
    journal = await prisma.journal.create({
      data: {
        userId,
        status: "PENDING",
      },
    });

    // 2. Enqueue the job for background processing.
    // This is a critical step. If this fails, we need to handle it.
    await journalProcessingQueue.add("process-journal", {
      journalId: journal.id,
    });

    // 3. Respond immediately with a '201 Created' status.
    res.status(201).json({ journal });
  } catch (error) {
    // 4. DATA INTEGRITY: Implement a compensating action.
    // If the journal was created but the job could not be enqueued,
    // we must delete the journal to prevent orphaned records.
    if (journal) {
      console.error(
        `[API] CRITICAL: Job enqueue failed for journal ${journal.id}. Rolling back journal creation.`
      );
      await prisma.journal.delete({ where: { id: journal.id } });
    }

    // 5. Pass any errors to the global handler for consistent error logging.
    next(error);
  }
});

export default router;
```

#### **Action 6: Create the Skeleton Worker**

Create the new worker file, ensuring it also uses the new `REDIS_PASSWORD` variable. We'll also refine the logging slightly to focus on the Job ID as the primary identifier for better traceability.

```typescript
// file: goodnumbers/src/worker.ts

import "./lib/env.js"; // Ensure environment variables are loaded first
import { Worker } from "bullmq";
import { Redis } from "ioredis";

console.log("[Worker] Starting up...");

// --- Fatal Error Checks ---
if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error("FATAL: Redis connection variables are not set for worker.");
}

const connection = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT as string, 10),
  // SECURITY: Use the password from the environment variables.
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null,
  // PRODUCTION NOTE: For a real production deployment where Redis is on a
  // separate machine, you would need to enable TLS here for security.
  // Example: tls: { servername: process.env.REDIS_HOST }
});

const worker = new Worker(
  process.env.QUEUE_NAME || "journal-processing",
  async (job) => {
    // SECURE LOGGING: Focus on the Job ID as the primary identifier.
    console.log(
      `[Worker] Processing job ${job.id} (Journal ID: ${job.data.journalId})`
    );
    // Simulate a long-running task.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`[Worker] Finished job ${job.id}`);
    return { status: "done", journalId: job.data.journalId };
  },
  { connection }
);

// Event listeners provide observability into the worker's state.
worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} has completed successfully.`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[Worker] Job ${job?.id} has failed with error: ${err.message}`
  );
});

// Graceful shutdown ensures the worker finishes its current job before exiting.
const closeGracefully = async () => {
  console.log("[Worker] Shutting down gracefully...");
  await worker.close();
  connection.disconnect();
  process.exit(0);
};

process.on("SIGTERM", closeGracefully);
process.on("SIGINT", closeGracefully);

console.log(
  '[Worker] Worker listening for jobs on "' +
    (process.env.QUEUE_NAME || "journal-processing") +
    '" queue...'
);
```

#### **Action 7: Create PM2 Ecosystem Configuration**

Create `ecosystem.config.cjs`. We will add `env_production` blocks to ensure that we can set production-specific environment variables (like `NODE_ENV`) when we run the `npm start` command. This is a best practice for managing different deployment environments.

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
      // PRODUCTION: This block is used when running `pm2 start --env production`
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
      // PRODUCTION: This ensures the worker also runs in production mode.
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

#### **Action 8: Add/Update Scripts in `package.json`**

Update `package.json` with scripts to run the application using `pm2`.

```json
// file: goodnumbers/package.json
{
  "name": "goodnumbers",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "pm2 start ecosystem.config.cjs --env production",
    "stop": "pm2 stop ecosystem.config.cjs && pm2 delete ecosystem.config.cjs",
    "dev": "pm2 start ecosystem.config.cjs --watch",
    "logs": "pm2 logs",
    "build": "tsc",
    "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --runInBand",
    "lint": "eslint . --ext .ts",
    "prettier": "prettier --write ."
  },
  "type": "module",
  "dependencies": {
    "bullmq": "^5.8.2",
    "ioredis": "^5.4.1",
    "...": "..."
  },
  "devDependencies": {
    "pm2": "^5.4.0",
    "...": "..."
  }
}
```

#### **Action 9: Create Justfile for Simplified Workflow**

Create a `justfile` in the `goodnumbers/` root. This file is the new "front door" for all development tasks, providing simple, unified commands.

```makefile
# file: goodnumbers/justfile

# Provides simple, memorable commands for managing the development environment.

# --- SERVICE MANAGEMENT ---
# Starts background services (Redis) using Docker Compose in detached mode.
services-up:
    @echo "Starting Redis container..."
    @docker-compose up -d

# Stops and removes background services defined in Docker Compose.
services-down:
    @echo "Stopping and removing Redis container..."
    @docker-compose down

# --- APPLICATION MANAGEMENT ---
# Builds the TypeScript project.
build:
    @npm run build

# Starts the web server and worker in development mode with watch.
# Assumes services are already running via `just services-up`.
dev:
    @npm run dev

# Stops the web server and worker processes managed by pm2.
stop:
    @npm run stop

# Tails logs from both the web server and the worker.
logs:
    @npm run logs

# --- COMBINED WORKFLOWS ---
# A single command to build the project and start all services and application processes.
run: build services-up dev

# --- UTILITIES ---
# Cleans the project by stopping services, stopping the app, and removing node_modules.
clean: stop services-down
    @echo "Removing node_modules..."
    @rm -rf node_modules
```

#### **Action 10: Update Project `README.md`**

Finally, update the project's main `README.md` to reflect the new, simplified setup and workflow.

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
    Copy `.env.example` to `.env` and fill in the required `AUTH_*` secrets. The Redis password is already set up for local development.

    ```bash
    cp .env.example .env
    ```

3.  **Run Database Migrations:**

    ```bash
    npx prisma migrate dev
    ```

4.  **Build, Start Services, and Run App:**
    The `just run` command handles everything: it builds the TypeScript, starts Redis via Docker Compose, and starts the web server and worker with `pm2`.

    ```bash
    just run
    ```

5.  **View Logs:**
    To see the combined, real-time output from both the web server and the worker:
    ```bash
    just logs
    ```

### Stopping the Application

To stop the `pm2` processes and the Redis container:

```bash
just clean
```
````

#### **Action 11: Add Production Considerations Section**

It is crucial to document aspects of the design that are specific to a production environment. Add a new top-level section to this guide to capture these important details.

## 5. Production Security & Reliability Considerations

While this guide focuses on building a robust local development environment, several key adjustments are necessary for a production deployment.

### 5.1. Data-in-Transit Encryption (TLS)

When the application server and the Redis server are running on different machines, the connection between them must be encrypted. `ioredis` supports this via a `tls` configuration object. This prevents any third party on the network from eavesdropping on job data. This was omitted from the current implementation because our deployment model runs both processes on the same machine, but it is a non-negotiable requirement for any distributed setup.

### 5.2. Queue-Level Rate Limiting

The API has a global rate limiter, which is a great first line of defense. However, in a system with many users, it is possible for a single authenticated user to enqueue a large number of jobs, potentially starving the queue and preventing other users' jobs from being processed. For a future, scaled-up version of this application, we should consider implementing per-user rate limiting directly on the queue using features available in libraries like BullMQ Pro. This would provide a more granular and robust defense against this type of resource exhaustion.

#### **Action 12: Verify Success and Commit**

1.  **Run automated tests.** All tests should now pass. This is our "GREEN" state.
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
