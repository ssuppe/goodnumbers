// file: backend/tests/integration/journals.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as http from "http";
import type { Express } from "express";
import session from "supertest-session";
import type { User, Journal } from "@prisma/client";
import { PrismockClient } from "prismock";
import { prisma as originalPrisma } from "@src/lib/prisma.js";
import { getJournalQueue } from "@src/lib/queue.js";

// Mock prisma
vi.mock("@src/lib/prisma.js", () => ({
  prisma: new PrismockClient(),
}));

// Mock the queue
vi.mock('@src/lib/queue.js', () => ({
  getJournalQueue: vi.fn(() => ({
    add: vi.fn(),
  })),
  JOURNAL_QUEUE_NAME: 'journal-processing-mock'
}));

// Dynamically import the app *after* the mock is in place.
const { createApp } = await import("@src/index.js");
const testPrisma = originalPrisma as unknown as PrismockClient;
const mockGetJournalQueue = getJournalQueue as vi.Mock;

describe('/api/journals', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let user1: User;
  let user2: User;
  let journal1: Journal;
  let csrfToken: string;

  const user1Id = 'clvsf0mop000008jp3b3c1z9f';
  const user2Id = 'clvsf1mop000008jp3b3c1z9g';
  const journal1Id = 'clvsf2mop000008jp3b3c1z9h';

  beforeEach(async () => {
    mockGetJournalQueue.mockClear();
    await testPrisma.reset();
    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    agent = session(app);

    [user1, user2] = await testPrisma.user.createManyAndReturn({
      data: [
        { id: user1Id, email: `user1-${Date.now()}@test.com`, agreementsSigned: true, nightscoutUrl: 'https://user1.ns.com' },
        { id: user2Id, email: `user2-${Date.now()}@test.com`, agreementsSigned: true, nightscoutUrl: 'https://user2.ns.com' },
      ],
    });

    journal1 = await testPrisma.journal.create({
        data: { id: journal1Id, userId: user1.id, status: 'PROCESSING', progress: 50, statusMessage: 'Analyzing data...' },
    });

    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  describe('POST /api/journals', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent.post('/api/journals').send({ _csrf: csrfToken });
      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden if the CSRF token is missing', async () => {
      const res = await agent.post('/api/journals').set('x-test-user-id', user1.id).send({});
      expect(res.status).toBe(403);
    });

    it('should return 403 Forbidden if the user has not signed agreements', async () => {
      const unagreedUser = await testPrisma.user.create({
        data: { email: `unagreed-journal-user-${Date.now()}@test.com`, agreementsSigned: false },
      });
      const response = await agent.post('/api/journals').set('x-test-user-id', unagreedUser.id).send({ _csrf: csrfToken });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
    });

    it('should redirect to /setup-account if agreements are signed but account is not set up', async () => {
      const agreedUser = await testPrisma.user.create({
        data: { email: `agreed-not-setup-user-${Date.now()}@test.com`, agreementsSigned: true, nightscoutUrl: null },
      });
      const response = await agent.post('/api/journals').set('x-test-user-id', agreedUser.id).send({ _csrf: csrfToken });
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/setup-account');
    });

    it('should return 201 Created, status PENDING, and call the queue for a valid request', async () => {
        const res = await agent.post("/api/journals").set("x-test-user-id", user1.id).send({ _csrf: csrfToken });
        expect(res.status).toBe(201);
        expect(res.body.journal).toBeDefined();
        expect(res.body.journal.status).toBe("PENDING");
        const mockQueue = mockGetJournalQueue.mock.results[0].value;
        expect(mockGetJournalQueue).toHaveBeenCalled();
        expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('GET /api/journals/:id/status', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent.get(`/api/journals/${journal1.id}/status`);
      expect(res.status).toBe(401);
    });

    it('should return 400 Bad Request for a malformed journal ID', async () => {
      const malformedId = 'this-is-not-a-cuid';
      const res = await agent.get(`/api/journals/${malformedId}/status`).set('x-test-user-id', user1.id);
      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toContain('Invalid journal ID format.');
    });

    it('should return 404 Not Found for a non-existent journal ID', async () => {
      const nonExistentId = 'clvsf3mop000008jp3b3c1z9i';
      const res = await agent.get(`/api/journals/${nonExistentId}/status`).set('x-test-user-id', user1.id);
      expect(res.status).toBe(404);
    });

    it('should return 404 Not Found when requesting a journal owned by another user', async () => {
      const res = await agent.get(`/api/journals/${journal1.id}/status`).set('x-test-user-id', user2.id);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Journal not found.');
    });

    it('should return 200 OK with the correct status for a journal owned by the user', async () => {
      const res = await agent.get(`/api/journals/${journal1.id}/status`).set('x-test-user-id', user1.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'PROCESSING', progress: 50, statusMessage: 'Analyzing data...' });
    });
  });
});