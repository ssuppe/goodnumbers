import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import session from "supertest-session";
import * as http from "http";
import type { Express } from "express";
import type { User } from "@goodnumbers/types";
import { PrismockClient } from "prismock";
import { prisma as originalPrisma } from "@src/lib/prisma.js";

// --- This is the key to our targeted mocking pattern, translated to Vitest ---
const mockQueueInstance = {
  add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
};

vi.mock('@src/lib/queue.js', () => ({
  getJournalQueue: () => mockQueueInstance,
  JOURNAL_QUEUE_NAME: 'test-queue',
}));

// --- Add the Prismock pattern ---
vi.mock("@src/lib/prisma.js", () => ({
  prisma: new PrismockClient(),
}));

const { createApp } = await import('@src/index.js');
const testPrisma = originalPrisma as unknown as PrismockClient;

describe('API to Mock Job Queue Integration', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let testUser: User;
  let csrfToken: string;

  beforeAll(async () => {
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, async () => {
        agent = session(app);
        await testPrisma.reset();
        testUser = await testPrisma.user.create({
          data: {
            email: `queue-test-user-${Date.now()}@test.com`,
            agreementsSigned: true,
            nightscoutUrl: 'https://test.ns.com',
          },
        });
        const res = await agent.get('/api/csrf-token');
        csrfToken = res.body.csrfToken;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    mockQueueInstance.add.mockClear();
  });

  it('should create a PENDING journal in the DB and call the queue', async () => {
    const res = await agent
      .post('/api/journals')
      .set('x-test-user-id', testUser.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    const journalId = res.body.journal.id;
    expect(journalId).toBeDefined();

    // --- Assertions ---

    // 1. Verify the queue interaction
    expect(mockQueueInstance.add).toHaveBeenCalledWith('process-journal', {
      journalId: journalId,
    });
    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);

    // 2. Verify the database interaction (using testPrisma)
    const newJournal = await testPrisma.journal.findUnique({
      where: { id: journalId },
    });
    expect(newJournal).not.toBeNull();
    expect(newJournal?.userId).toBe(testUser.id);
    expect(newJournal?.status).toBe('PENDING');
  });
});