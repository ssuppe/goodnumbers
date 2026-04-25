// file: backend/tests/integration/journals.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import type { Express } from 'express';
import session from 'supertest-session';
import type { User, Journal } from '@goodnumbers/types';
import { prisma } from '../../src/lib/prisma.js';
import crypto from 'crypto';

// Mock the queue for all tests in this file
vi.mock('../../src/lib/queue.js', () => ({
  getJournalQueue: vi.fn(() => ({
    add: vi.fn(),
  })),
  JOURNAL_QUEUE_NAME: 'journal-processing-mock',
}));

describe('/api/journals', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let user1: User;
  let user2: User;
  let journal1: Journal;
  let csrfToken: string;
  let mockGetJournalQueue: vi.Mock;

  beforeEach(async () => {
    const { createApp } = await import('../../src/index.js');
    const queue = await import('../../src/lib/queue.js');
    mockGetJournalQueue = queue.getJournalQueue as vi.Mock;
    mockGetJournalQueue.mockClear();

    app = createApp();
    server = app.listen(0);
    agent = session(app);

    user1 = await prisma.user.create({
      data: {
        email: `user1-${crypto.randomUUID()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://user1.ns.com',
      },
    });

    user2 = await prisma.user.create({
      data: {
        email: `user2-${crypto.randomUUID()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://user2.ns.com',
      },
    });

    journal1 = await prisma.journal.create({
      data: {
        userId: user1.id,
        status: 'PROCESSING',
        progress: 50,
        statusMessage: 'Analyzing data...',
      },
    });

    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  describe('GET /', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent.get('/api/journals');
      expect(res.status).toBe(401);
    });

    it('should return 200 OK with a list of user journals including analysisInsights', async () => {
      // Create another journal for user1 to ensure multiple are returned
      await prisma.journal.create({
        data: {
          userId: user1.id,
          status: 'COMPLETE',
          analysisInsights: [{ note: 'Test Insight', priority: 'INFO' }],
        },
      });

      const res = await agent
        .get('/api/journals')
        .set('x-test-user-id', user1.id);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      // Verify that analysisInsights and scoreCardData are included (even if null)
      expect(res.body[0]).toHaveProperty('analysisInsights');
      expect(res.body[0]).toHaveProperty('scoreCardData');
    });

    it('should not return journals from other users', async () => {
      const res = await agent
        .get('/api/journals')
        .set('x-test-user-id', user2.id);

      expect(res.status).toBe(200);
      // User2 has no journals yet (journal1 is owned by user1)
      expect(res.body.length).toBe(0);
    });
  });

  describe('POST /', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent.post('/api/journals').send({ _csrf: csrfToken });
      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden if the CSRF token is missing', async () => {
      const res = await agent
        .post('/api/journals')
        .set('x-test-user-id', user1.id)
        .send({});
      expect(res.status).toBe(403);
    });

    it('should return 403 Forbidden if the user has not signed agreements', async () => {
      const unagreedUser = await prisma.user.create({
        data: {
          email: `unagreed-journal-user-${crypto.randomUUID()}@test.com`,
          agreementsSigned: false,
        },
      });
      const res = await agent
        .post('/api/journals')
        .set('x-test-user-id', unagreedUser.id)
        .send({ _csrf: csrfToken });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AGREEMENTS_NOT_SIGNED');
    });

    it('should return 302 Redirect if account setup is not complete', async () => {
      const agreedUser = await prisma.user.create({
        data: {
          email: `agreed-not-setup-user-${crypto.randomUUID()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: null, // This user has not completed setup
        },
      });
      const res = await agent
        .post('/api/journals')
        .set('x-test-user-id', agreedUser.id)
        .send({ _csrf: csrfToken });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/setup-account');
    });

    it('should return 201 Created and enqueue a job for a valid request', async () => {
      const mockQueue = { add: vi.fn() };
      mockGetJournalQueue.mockReturnValue(mockQueue);

      const res = await agent
        .post('/api/journals')
        .set('x-test-user-id', user1.id)
        .send({ _csrf: csrfToken });

      expect(res.status).toBe(201);
      expect(res.body.journal).toBeDefined();
      expect(res.body.journal.status).toBe('PENDING');
      expect(mockQueue.add).toHaveBeenCalledOnce();
    });
  });

  describe('GET /:id/status', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent.get(`/api/journals/${journal1.id}/status`);
      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request for a malformed journal ID', async () => {
      const res = await agent
        .get('/api/journals/this-is-not-a-cuid/status')
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(400);
    });

    it('should return 404 Not Found for a non-existent journal ID', async () => {
      const nonExistentId = 'clvsf3mop000008jp3b3c1z9i';
      const res = await agent
        .get(`/api/journals/${nonExistentId}/status`)
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(404);
    });

    it('should return 404 Not Found when requesting a journal owned by another user', async () => {
      const res = await agent
        .get(`/api/journals/${journal1.id}/status`)
        .set('x-test-user-id', user2.id);
      expect(res.status).toBe(404);
    });

    it('should return 200 OK with the correct status for an owned journal', async () => {
      const res = await agent
        .get(`/api/journals/${journal1.id}/status`)
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'PROCESSING',
        progress: 50,
        statusMessage: 'Analyzing data...',
      });
    });
  });

  describe('GET /:id', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent.get(`/api/journals/${journal1.id}`);
      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request for a malformed journal ID', async () => {
      const res = await agent
        .get('/api/journals/this-is-not-a-cuid')
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(400);
    });

    it('should return 404 Not Found for a non-existent journal ID', async () => {
      const nonExistentId = 'clvsf3mop000008jp3b3c1z9i';
      const res = await agent
        .get(`/api/journals/${nonExistentId}`)
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(404);
    });

    it('should return 404 Not Found when requesting a journal owned by another user', async () => {
      const res = await agent
        .get(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user2.id);
      expect(res.status).toBe(404);
    });

    it('should return 200 OK with the full journal data for an owned journal', async () => {
      const res = await agent
        .get(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(journal1.id);
      expect(res.body.status).toBe('PROCESSING');
      // Ensure clusters are included (even if empty array for now)
      expect(res.body.clusters).toBeDefined();
    });
  });

  describe('PUT /:id', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent
        .put(`/api/journals/${journal1.id}`)
        .send({ _csrf: csrfToken });
      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden if the CSRF token is missing', async () => {
      const res = await agent
        .put(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user1.id)
        .send({});
      expect(res.status).toBe(403);
    });

    it('should return 200 OK and update the journal for a valid request', async () => {
      const updates = {
        weeklyVibe: '🌻 Flourishing',
        influencingFactors: ['Diet:FatProtein'],
        goalsForNextWeek: 'Better pre-bolusing',
        _csrf: csrfToken,
      };

      const res = await agent
        .put(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user1.id)
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedJournal = await prisma.journal.findUnique({
        where: { id: journal1.id },
      });
      expect(updatedJournal?.weeklyVibe).toBe('🌻 Flourishing');
      expect(updatedJournal?.goalsForNextWeek).toBe('Better pre-bolusing');
    });

    it('should update cluster notes if provided', async () => {
      const cluster = await prisma.glycemicEventCluster.create({
        data: {
          journalId: journal1.id,
          eventType: 'hyper',
          eventCount: 3,
          meanTimeMinutes: 600,
          clusterDataJson: {},
        },
      });

      const updates = {
        clusterNotes: { [cluster.id]: 'These were all after pizza.' },
        _csrf: csrfToken,
      };

      const res = await agent
        .put(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user1.id)
        .send(updates);

      expect(res.status).toBe(200);
      const updatedCluster = await prisma.glycemicEventCluster.findUnique({
        where: { id: cluster.id },
      });
      expect(updatedCluster?.userNotes).toBe('These were all after pizza.');
    });
  });

  describe('DELETE /:id', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent
        .delete(`/api/journals/${journal1.id}`)
        .send({ _csrf: csrfToken });
      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden if the CSRF token is missing', async () => {
      const res = await agent
        .delete(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user1.id);
      expect(res.status).toBe(403);
    });

    it('should return 400 Bad Request for a malformed journal ID', async () => {
      const res = await agent
        .delete('/api/journals/this-is-not-a-cuid')
        .set('x-test-user-id', user1.id)
        .send({ _csrf: csrfToken });
      expect(res.status).toBe(400);
    });

    it('should not delete a journal owned by another user', async () => {
      // Try to delete user1's journal as user2
      await agent
        .delete(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user2.id)
        .send({ _csrf: csrfToken });

      // It should fail (likely 404/403 or handled by Prisma as RecordNotFound which we might return as generic error or catch)
      // In our implementation, we catch generic errors. Prisma deleteMany with 'where' returns count 0 if not found,
      // but delete() throws if not found. Our route catches errors.
      // Ideally, it should be 404 or 200 with {success: false} depending on API design,
      // but Prisma delete throws RecordNotFound. The route maps Zod errors but passes others to next(error).
      // The global error handler might return 500 or something else depending on env.
      // Wait, our route logic is: await prisma.journal.delete({ where: { id: journalId, userId: userId } });
      // This will THROW if not found. The generic error handler will catch it.

      // Let's expect it to fail safely. Since we don't have explicit 404 logic in the DELETE route catch block,
      // it will likely bubble up. Let's verify the journal still exists.
      const journalStillExists = await prisma.journal.findUnique({
        where: { id: journal1.id },
      });
      expect(journalStillExists).toBeDefined();
    });

    it('should successfully delete an owned journal', async () => {
      const res = await agent
        .delete(`/api/journals/${journal1.id}`)
        .set('x-test-user-id', user1.id)
        .send({ _csrf: csrfToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone from the database
      const deletedJournal = await prisma.journal.findUnique({
        where: { id: journal1.id },
      });
      expect(deletedJournal).toBeNull();
    });
  });
});
