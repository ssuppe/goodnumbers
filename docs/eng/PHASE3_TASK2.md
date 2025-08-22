# Engineering Plan: Phase 3, Task 2 - Background Job Queue Setup (Revised)

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

*   **Services Run in Docker:** We will run our backing services, like the Redis database, inside a Docker container. This gives us a consistent, isolated, and secure environment for our dependencies without needing to install them directly on our local machine.
*   **Application Code Runs Locally:** We will continue to run our Node.js application directly on our machine using `npm run dev`. This gives us the fast feedback loop and hot-reloading capabilities of `nodemon`, which is essential for productive development.

This approach provides the best of both worlds: the stability and consistency of Docker for services, and the speed and flexibility of local development for our own code.

## 3. Step-by-Step Implementation Guide

### Step 3.1: GitHub Issue and Branch Setup

First, as per our `DEVELOPMENT_PROCESS.md`, create a GitHub issue to track this task.

```bash
# Run this from the project's root directory (goodnumbers-workspace)
gh issue create --title "feat(worker): P3_T2 integrate bullmq for background job processing" --body "This task involves setting up BullMQ with Redis to handle background jobs for journal creation. It includes modifying the journal creation API to enqueue jobs and creating a skeleton worker to process them. Reference: docs/eng/PHASE3_TASK2.md"
```

Note the issue number that is created (e.g., #55). Now, create your feature branch from the latest `develop` branch.

```bash
# Ensure your local develop branch is up to date
git checkout develop
git pull

# Create the feature branch using the new issue number
git checkout -b feat/55-bullmq-integration
```

### Step 3.2: Dependency Installation

Navigate into the `goodnumbers` project directory and install the necessary libraries for BullMQ and Redis.

```bash
cd goodnumbers
npm install bullmq ioredis
npm install -D @types/ioredis
cd ..
```

*   `bullmq`: The powerful job queue library we will use.
*   `ioredis`: A robust and performant Redis client for Node.js that BullMQ uses under the hood.
*   `@types/ioredis`: TypeScript definitions for `ioredis`.

### Step 3.3: Local Environment Setup (Docker for Redis)

We will now define our local Redis service using Docker Compose.

**1. Create the Docker Compose File**

This file will define and configure our Redis service. Create a new file at `goodnumbers/docker-compose.yml`.

```yaml
# goodnumbers/docker-compose.yml
version: '3.8'

services:
  # The Redis service
  redis:
    image: redis:7-alpine
    restart: always
    # SECURITY: This sets the required password for Redis.
    # The value is fetched from the .env file on your local machine.
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      # This is the key change for our hybrid setup: It maps port 6379 inside
      # the container to port 6379 on your local machine (localhost). This
      # allows your locally running Node.js app to connect to it.
      - "6379:6379"
    volumes:
      # (Optional but Recommended) This makes your Redis data persist even
      # if you stop and restart the container. It's very useful for development.
      - redis-data:/data

volumes:
  redis-data:
```

**2. Update Environment Configuration**

We need to add the new Redis configuration variables to our example environment file so that other developers know what to set up.

```markdown
# goodnumbers/.env.example
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
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# Generate a strong password for local development
REDIS_PASSWORD=your_super_secret_local_password
```

**Action:** If you haven't already, create a `.env` file in the `goodnumbers/` directory by copying `.env.example`. Fill in all the values, including a strong, unique password for `REDIS_PASSWORD`.

### Step 3.4: The Recommended Development Workflow

To work on this task, you will use two separate terminals, both navigated to the `goodnumbers/` directory. This approach gives you clear, separate logs for your services and your application, which is incredibly helpful for debugging.

**Terminal 1: Start Redis**
In this terminal, you will start the Redis service using Docker.

```bash
# In goodnumbers/
docker-compose up
```

You can leave this terminal running. It will show you the live logs from the Redis server.

**Terminal 2: Start Your Application**
In your second terminal, you will run the Node.js application with `nodemon` as usual.

```bash
# In goodnumbers/
npm run dev
```

Your Node.js application, running locally, will now be able to connect to the Redis server running inside Docker.

### Step 3.5: Test-Driven Implementation

Now we will follow the Red-Green-Refactor cycle to build the feature.

#### **1. (RED) Write the Failing Test**

First, we'll create an integration test that checks if creating a journal successfully adds a job to the Redis queue. This test will fail because we haven't implemented the queueing logic yet.

```typescript
// goodnumbers/tests/integration/queue.test.ts
import 'dotenv/config';
import request from 'supertest';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import app from '../../src/index';
import { prisma } from '../../src/db';
import type { User } from '@prisma/client';

// Use a unique queue name for testing to avoid conflicts
const TEST_QUEUE_NAME = `test-journal-queue-${Date.now()}`;

// Mock the real journalQueue before any imports.
// NOTE FOR ENGINEER: This mock intercepts any attempt to import from '../../src/lib/queue'.
// It replaces the real 'journalQueue' export with a dedicated test instance.
// This is critical for isolating our test and ensuring we can assert against a predictable queue.
jest.mock('../../src/lib/queue', () => {
  const originalModule = jest.requireActual('../../src/lib/queue');
  const { Queue } = require('bullmq');
  const redis = require('ioredis');

  // Create a dedicated test queue that we can control
  const testConnection = new redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  });

  const testJournalQueue = new Queue(TEST_QUEUE_NAME, {
    connection: testConnection,
  });

  return {
    ...originalModule,
    __esModule: true,
    journalQueue: testJournalQueue, // Replace the real queue with our test queue
  };
});


describe('BullMQ Job Queue Integration', () => {
  let testUser: User;
  let agent: request.SuperAgentTest;
  let csrfToken: string;
  let testQueue: Queue;

  beforeAll(async () => {
    // We can now get our mocked queue instance directly
    const queueModule = await import('../../src/lib/queue');
    testQueue = queueModule.journalQueue;
    
    // Create a test user
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: { email: 'queue-test@example.com' },
    });

    // Set up a supertest agent to handle cookies for CSRF
    agent = request.agent(app);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  afterEach(async () => {
    // Clear the queue after each test
    await testQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    // Clean up connections
    await testQueue.close();
    (testQueue.connection as Redis).disconnect();
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('POST /api/journals should enqueue a job in BullMQ', async () => {
    // Act: Call the endpoint to create a journal
    const response = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken)
      .send({});

    expect(response.status).toBe(201);
    const journalId = response.body.id;

    // Assert: Check if a job was added to our test queue
    const jobs = await testQueue.getJobs(['waiting']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.journalId).toBe(journalId);
    expect(jobs[0].name).toBe('generate-journal');
  });
});
```

Run this new test file (`npm test -- tests/integration/queue.test.ts`). It will fail because the API is not yet queueing jobs. This is our "Red" state.

#### **2. (GREEN) Implement the Queueing Logic**

Now, let's write the code to make the test pass.

**a. Create a Centralized Queue Configuration**

This file will manage the connection to Redis and export our BullMQ `Queue` instance.

```typescript
// goodnumbers/src/lib/queue.ts
import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Define the name of our queue
export const JOURNAL_QUEUE_NAME = 'journal-generation';

// Create a Redis connection instance. BullMQ reuses this connection.
const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Recommended for BullMQ
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Create and export the BullMQ queue instance
export const journalQueue = new Queue(JOURNAL_QUEUE_NAME, { connection });
```

**b. Modify the Journal Creation Endpoint**

Update `goodnumbers/src/routes/journals.ts` to add a job to the queue when a new journal is created.

```typescript
// goodnumbers/src/routes/journals.ts
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { protect } from '../middleware/auth.js';
import { journalQueue } from '../lib/queue.js'; // <-- IMPORT THE QUEUE

const router = Router();

// Zod schema for validating CUIDs in route parameters
const paramsSchema = z.object({
  id: z.string().cuid2({ message: 'Invalid ID format' }),
});

// GET /api/journals - Fetch all journals for the logged-in user
router.get('/', protect, async (req, res, next) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const journals = await prisma.journal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(journals);
  } catch (error: unknown) {
    next(error);
  }
});

// GET /api/journals/:id - Fetch a single journal by its ID
router.get('/:id', protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
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
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.status(200).json(journal);
  } catch (error: unknown) {
    next(error);
  }
});

// POST /api/journals - Create a new journal entry
router.post('/', protect, async (req, res, next) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const newJournal = await prisma.journal.create({
      data: {
        userId: userId,
        status: 'PENDING',
        progress: 0,
      },
    });

    // --- NEW LOGIC: Enqueue the job ---
    await journalQueue.add('generate-journal', { journalId: newJournal.id });

    res.status(201).json(newJournal);
  } catch (error: unknown) {
    next(error);
  }
});

// GET /api/journals/status/:id - Poll for journal generation progress
router.get('/status/:id', protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: validation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
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
      return res.status(404).json({ error: 'Journal not found' });
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

router.put('/:id', protect, async (req, res, next) => {
  try {
    const paramsValidation = paramsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({
        error: 'Invalid request parameter',
        details: paramsValidation.error.flatten().fieldErrors,
      });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const { id } = paramsValidation.data;

    const bodyValidation = updateJournalSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
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
        throw new Error('Journal not found or permission denied');
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
    if ((error as Error).message.includes('permission denied')) {
        return res.status(404).json({ error: 'Journal not found' });
    }
    next(error);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const validation = paramsSchema.safeParse(req.params);
    if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request parameter',
          details: validation.error.flatten().fieldErrors,
        });
    }
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const { id } = validation.data;

    const deleteResult = await prisma.journal.deleteMany({
      where: { id: id, userId: userId },
    });

    if (deleteResult.count === 0) {
      return res.status(404).json({ error: 'Journal not found' });
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
// goodnumbers/src/worker.ts
import 'dotenv/config'; // Make sure to load environment variables
import { Worker } from 'bullmq';
import Redis from 'ioredis';

// Import the queue name to ensure consistency
import { JOURNAL_QUEUE_NAME } from './lib/queue.js';

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

console.log(`Worker process started, connected to Redis on ${process.env.REDIS_HOST}.`);

// Create a new Worker instance
const worker = new Worker(
  JOURNAL_QUEUE_NAME,
  async (job) => {
    // For this task, we just log the job data.
    // In future tasks, this is where the heavy lifting will happen.
    console.log(`[Worker] Processing job #${job.id} for journal: ${job.data.journalId}`);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`[Worker] Completed job #${job.id}`);

    return { status: 'Complete', journalId: job.data.journalId };
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} has failed with error: ${err.message}`);
});

// --- BEST PRACTICE: Add Graceful Shutdown Logic ---
const gracefulShutdown = async (signal: string) => {
  console.log(`[Worker] Received ${signal}, shutting down gracefully...`);
  await worker.close();
  console.log('[Worker] All jobs processed, closing Redis connection.');
  await connection.quit();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```

**d. Add a Worker Script to `package.json`**

This allows us to run the worker process easily.

```json
// goodnumbers/package.json
{
  "name": "goodnumbers",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node dist/index.js",
    "worker": "node dist/worker.js",
    "//": "The 'dev' script is simplified to only run nodemon.",
    "//": "The developer will run 'docker-compose up' in a separate terminal as per the docs.",
    "dev": "nodemon",
    "build": "tsc",
    "test": "NODE_OPTIONS=\"--experimental-vm-modules\" jest --detectOpenHandles",
    "lint": "eslint . --ext .ts",
    "prettier": "prettier --write .",
    "test-all": "NODE_OPTIONS=\"--experimental-vm-modules\" jest"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "src/**/*.{ts,tsx},tests/**/*.{ts,tsx}": [
      "npm run test-all"
    ]
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
Now, re-run the tests. They should pass. You have successfully implemented the feature.

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

You have now completed the task with a robust and professional development setup.