// file: goodnumbers-workspace/goodnumbers/tests/integration/real-queue.test.ts

import 'dotenv/config';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from '@jest/globals';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import supertest from 'supertest';
import { createId } from '@paralleldrive/cuid2';
import type { User } from '@prisma/client';

import { prisma } from '../../src/db';

// --- Test Setup: Isolated Queue Configuration ---
// 1. Generate a unique queue name for this specific test file run.
//    This prevents collisions with other running tests or a local dev server.
const TEST_QUEUE_NAME = `test-real-journal-queue-${createId()}`;

describe('BullMQ True Integration with Real Redis', () => {
  let realTestQueue: Queue;
  let redisConnection: Redis;
  let testUser: User;
  let agent: supertest.SuperAgentTest;
  let csrfToken: string;
  let appModule: typeof import('../../src/index'); // To hold the dynamically imported app
  let queueModule: typeof import('../../src/lib/queue'); // To hold the dynamically imported queue module

  // -- Test Lifecycle: Setup --
  beforeAll(async () => {
    // CRITICAL: Reset modules to ensure app and queue.ts are re-imported after env var is set
    jest.resetModules();

    // Set the environment variable here, before importing the app
    process.env.QUEUE_NAME = TEST_QUEUE_NAME;

    // Dynamically import the app and queue module AFTER the environment variable is set
    appModule = await import('../../src/index');
    queueModule = await import('../../src/lib/queue'); // Load the module to access its connection

    // 1. Establish a direct connection to the REAL Redis instance for test assertions.
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

    // 2. Create a BullMQ Queue instance in our test to inspect the queue.
    realTestQueue = new Queue(TEST_QUEUE_NAME, { connection: redisConnection });

    // 3. Prepare the database state.
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: { email: `real-queue-test-${createId()}@example.com` },
    });

    // 4. Prepare the HTTP agent and get a CSRF token.
    agent = supertest.agent(appModule.default);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;

    console.log(
      `[TEST_SETUP] Real Redis test setup complete. Using isolated queue: ${TEST_QUEUE_NAME}`,
    );
  }, 20000);

  // -- Test Lifecycle: Teardown --
  afterEach(async () => {
    await realTestQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    // Gracefully close all connections
    await realTestQueue.close();
    await redisConnection.quit(); // Closes the connection used by the test itself
    await queueModule.connection.quit(); // Closes the connection used by the main app
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
