// file: goodnumbers-workspace/goodnumbers/tests/integration/queue.test.ts
import 'dotenv/config';
import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
} from '@jest/globals';
import type { User } from '@prisma/client';
import type Redis from 'ioredis';

// Use a unique queue name for testing to avoid conflicts with a running dev server
const TEST_QUEUE_NAME = `test-journal-queue-${Date.now()}`;

// ====================================================================================
// CORRECTED MOCKING STRATEGY (Following ES Module Best Practices)
//
// The factory function for the mock MUST be an `async` function to allow the use of
// `await import()`, which is the correct way to load modules within an ES Module scope.
// ====================================================================================
jest.unstable_mockModule('../../src/lib/queue', async () => {
  // CORRECTED: Use dynamic `await import()` instead of `require()`
  const { Queue: BullQueue } = await import('bullmq');
  // CORRECTED: `ioredis` uses a default export, so we must access it with `.default`
  const RedisClient = (await import('ioredis')).default;

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

describe('BullMQ Job Queue Integration', () => {
  let testUser: User;
  let agent: import('supertest').SuperAgentTest;
  let csrfToken: string;
  let testQueue: import('bullmq').Queue;
  let prisma: import('@prisma/client').PrismaClient;
  let app: import('express').Express;

  beforeAll(async () => {
    console.log(
      '[TEST_SETUP] Starting beforeAll for queue integration test...',
    );
    // Dynamically import all necessary modules AFTER the mock has been set up.
    const queueModule = await import('../../src/lib/queue');
    const dbModule = await import('../../src/db');
    const appModule = await import('../../src/index');
    const supertest = (await import('supertest')).default;

    testQueue = queueModule.journalQueue;
    prisma = dbModule.prisma;
    app = appModule.default;

    console.log(
      '[TEST_SETUP] Obliterating test queue to ensure clean state...',
    );
    await testQueue.obliterate({ force: true });

    console.log('[TEST_SETUP] Deleting and creating test user...');
    await prisma.journal.deleteMany({}); // Ensure journals are deleted first
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: { email: 'queue-test@example.com' },
    });
    console.log(`[TEST_SETUP] Test user created with ID: ${testUser.id}`);

    agent = supertest.agent(app);
    console.log('[TEST_SETUP] Fetching CSRF token...');
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
    console.log('[TEST_SETUP] beforeAll complete.');
  });

  afterEach(async () => {
    console.log('[TEST_TEARDOWN] Cleaning queue after test...');
    await testQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    console.log('[TEST_TEARDOWN] Closing queue and database connections...');
    await testQueue.close();
    (testQueue.connection as Redis).disconnect();
    await prisma.journal.deleteMany({}); // Ensure journals are deleted before users
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
    console.log('[TEST_TEARDOWN] All connections closed.');
  });

  it('POST /api/journals should enqueue a job in BullMQ', async () => {
    console.log(
      '[TEST_RUN] Executing test: POST /api/journals should enqueue a job...',
    );
    // Act: Call the endpoint to create a journal.
    const response = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .set('x-csrf-token', csrfToken)
      .send({});

    console.log(`[TEST_RUN] API response status: ${response.status}`);
    expect(response.status).toBe(201);
    const journalId = response.body.id;
    console.log(`[TEST_RUN] Journal created with ID: ${journalId}`);

    // Assert: Check if a job was added to our test queue.
    console.log('[TEST_RUN] Checking for jobs in the test queue...');
    const jobs = await testQueue.getJobs(['waiting']);
    console.log(`[TEST_RUN] Found ${jobs.length} job(s).`);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.journalId).toBe(journalId);
    expect(jobs[0].name).toBe('generate-journal');
    console.log(`[TEST_RUN] Job data validated successfully.`);
  });
});
