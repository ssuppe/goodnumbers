import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { PrismaClient, User } from '@prisma/client';
import session from 'supertest-session';
import * as http from 'http';
import type { Express } from 'express';

// --- This is the new, targeted mocking pattern ---

// 1. Create our mock queue instance in the test scope.
const mockQueueInstance = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
};

// 2. Mock our *own* queue module. We tell Jest: "When the application asks
//    for src/lib/queue.ts, give it this version instead."
jest.unstable_mockModule('../../src/lib/queue.js', () => ({
  // Provide a fake getJournalQueue function that returns our mock instance.
  getJournalQueue: () => mockQueueInstance,
  // Also provide the queue name constant.
  JOURNAL_QUEUE_NAME: 'test-queue',
}));

// 3. Dynamically import the app. Now when it loads and calls getJournalQueue(),
//    it will receive our mock instance.
const { createApp } = await import('../../src/index.js');

// --- End of pattern ---

const prisma = new PrismaClient();
let app: Express;
let server: http.Server;
let agent: session.Session;
let testUser: User;
let csrfToken: string;

describe('API to Mock Job Queue Integration', () => {
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
        email: `final-queue-test-${Date.now()}@example.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://final-queue.ns.com',
      },
    });

    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  
  beforeEach(() => {
    mockQueueInstance.add.mockClear();
  });

  it('POST /api/journals should create a journal and add a job to the mock queue', async () => {
    // Act
    const response = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .send({ _csrf: csrfToken });

    expect(response.status).toBe(201);
    const journalId = response.body.journal.id;

    // Assert
    expect(mockQueueInstance.add).toHaveBeenCalledWith('process-journal', {
      journalId: journalId,
    });
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
  });
});