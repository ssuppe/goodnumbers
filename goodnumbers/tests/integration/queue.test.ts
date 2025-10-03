import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
// NEW: Import PrismaClient to interact with the database
import { PrismaClient, User } from '@prisma/client';
import session from 'supertest-session';
import * as http from 'http';
import type { Express } from 'express';

// --- This is the key to our targeted mocking pattern ---

const mockQueueInstance = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
};

jest.unstable_mockModule('../../src/lib/queue.js', () => ({
  getJournalQueue: () => mockQueueInstance,
  JOURNAL_QUEUE_NAME: 'test-queue',
}));

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
      server = app.listen(0, async () => {
        agent = session(app);
        await prisma.journal.deleteMany({}); // Clean journals table
        await prisma.user.deleteMany();
        testUser = await prisma.user.create({
          data: {
            email: `queue-test-user-${Date.now()}@test.com`,
            agreementsSigned: true,
            nightscoutUrl: 'https://test.ns.com',
          },
        });
        const res = await agent.get('/api/csrf-token');
        csrfToken = res.body.csrfToken;
        resolve(); // Signal that setup is complete
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    mockQueueInstance.add.mockClear();
  });

  // NEW: The test name is now more descriptive of its expanded responsibilities.
  it('should create a PENDING journal in the DB and call the queue', async () => {
    const res = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    const journalId = res.body.journal.id;
    expect(journalId).toBeDefined();

    // --- Assertions ---

    // 1. Verify the queue interaction (same as before)
    expect(mockQueueInstance.add).toHaveBeenCalledWith('process-journal', {
      journalId: journalId,
    });
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);

    // 2. NEW: Verify the database interaction
    const newJournal = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    expect(newJournal).not.toBeNull();
    expect(newJournal?.userId).toBe(testUser.id);
    expect(newJournal?.status).toBe('PENDING'); // This is the critical check
  });
});
