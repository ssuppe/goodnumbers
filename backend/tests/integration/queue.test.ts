import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
} from 'vitest';
import session from 'supertest-session';
import * as http from 'http';
import type { Express } from 'express';
import { prisma } from '@src/lib/prisma.js';
import type { User } from '@goodnumbers/types';

// This is the key to our targeted mocking pattern, translated to Vitest
// We mock the queue library to intercept calls to it.
vi.mock('@src/lib/queue.js', () => ({
  getJournalQueue: vi.fn(),
  JOURNAL_QUEUE_NAME: 'journal-processing-mock',
}));

describe('API to Mock Job Queue Integration', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let testUser: User;
  let csrfToken: string;

  beforeEach(async () => {
    const { createApp } = await import('@src/index.js');

    await prisma.user.deleteMany({});

    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    agent = session(app);

    testUser = await prisma.user.create({
      data: {
        email: `queue-test-user-${Date.now()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://test.ns.com',
      },
    });

    const res = await agent.get('/api/csrf-token');
    csrfToken = res.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  it('should create a PENDING journal in the DB and call the queue', async () => {
    const { getJournalQueue } = await import('@src/lib/queue.js');
    const mockGetJournalQueue = getJournalQueue as vi.Mock;
    const mockQueueInstance = { add: vi.fn() };
    mockGetJournalQueue.mockReturnValue(mockQueueInstance);

    const res = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    const journalId = res.body.journal.id;
    expect(journalId).toBeDefined();

    // 1. Verify the queue interaction
    expect(mockGetJournalQueue).toHaveBeenCalledTimes(1);
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);

    // 2. Verify the database interaction
    const newJournal = await prisma.journal.findUnique({
      where: { id: journalId },
    });
    expect(newJournal).not.toBeNull();
    expect(newJournal?.status).toBe('PENDING');
    expect(newJournal?.userId).toBe(testUser.id);
  });
});
