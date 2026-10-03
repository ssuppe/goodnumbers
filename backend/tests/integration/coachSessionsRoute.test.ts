// file: backend/tests/integration/coachSessionsRoute.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import type { Express } from 'express';
import session from 'supertest-session';
import type { User } from '@goodnumbers/types';
import { prisma } from '../../src/lib/prisma.js';
import crypto from 'crypto';

// Mock the queue
const mockQueueAdd = vi.fn();
vi.mock('../../src/lib/queue.js', () => ({
  getJournalQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
  JOURNAL_QUEUE_NAME: 'journal-processing-mock',
}));

describe('POST /api/coach/sessions', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let user: User;
  let csrfToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: 'job-123' });

    const { createApp } = await import('../../src/index.js');
    app = createApp();
    server = app.listen(0);
    agent = session(app);

    // Create user with valid Nightscout credentials and signed agreements
    user = await prisma.user.create({
      data: {
        email: `coach-user-${crypto.randomUUID()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://user.ns.com',
        nightscoutToken: 'secret-token',
      },
    });

    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
    await prisma.journal.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('returns 401 Unauthorized if no user is authenticated', async () => {
    const res = await agent
      .post('/api/coach/sessions')
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(401);
  });

  it('returns 403 Forbidden if CSRF token is missing', async () => {
    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', user.id)
      .send({});

    expect(res.status).toBe(403);
  });

  it('returns 403 Forbidden if user has not signed agreements', async () => {
    const unagreedUser = await prisma.user.create({
      data: {
        email: `unagreed-${crypto.randomUUID()}@test.com`,
        agreementsSigned: false,
      },
    });

    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', unagreedUser.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AGREEMENTS_NOT_SIGNED');

    await prisma.user.delete({ where: { id: unagreedUser.id } });
  });

  it('returns 400 Bad Request if user has not configured Nightscout credentials', async () => {
    const noNsUser = await prisma.user.create({
      data: {
        email: `no-ns-${crypto.randomUUID()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: null,
        nightscoutToken: null,
      },
    });

    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', noNsUser.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NIGHTSCOUT_REQUIRED');

    await prisma.user.delete({ where: { id: noNsUser.id } });
  });

  it('returns 409 Conflict if a journal is already in PENDING status', async () => {
    await prisma.journal.create({
      data: {
        userId: user.id,
        status: 'PENDING',
      },
    });

    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', user.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already in progress');
  });

  it('returns 409 Conflict if a journal is in active processing status (e.g., ANALYZING_DATA)', async () => {
    await prisma.journal.create({
      data: {
        userId: user.id,
        status: 'ANALYZING_DATA',
        progress: 30,
      },
    });

    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', user.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SESSION_IN_PROGRESS');
  });

  it('returns 201 Created, creates a PENDING journal with 7-day window, and enqueues BullMQ job', async () => {
    const beforeRequest = Date.now();

    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', user.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('journalId');
    expect(res.body.status).toBe('PENDING');

    // Verify DB record
    const createdJournal = await prisma.journal.findUnique({
      where: { id: res.body.journalId },
    });
    expect(createdJournal).not.toBeNull();
    expect(createdJournal?.userId).toBe(user.id);
    expect(createdJournal?.status).toBe('PENDING');
    expect(createdJournal?.startDate).toBeDefined();
    expect(createdJournal?.endDate).toBeDefined();

    // Verify 7-day range
    const start = new Date(createdJournal!.startDate!).getTime();
    const end = new Date(createdJournal!.endDate!).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(end - start).toBeCloseTo(sevenDaysMs, -3); // within seconds
    expect(end).toBeGreaterThanOrEqual(beforeRequest);

    // Verify queue call
    expect(mockQueueAdd).toHaveBeenCalledWith('process-journal', {
      journalId: res.body.journalId,
    });
  });

  it('rolls back and deletes the created journal if queue enqueue fails', async () => {
    mockQueueAdd.mockRejectedValueOnce(new Error('Redis connection failed'));

    const res = await agent
      .post('/api/coach/sessions')
      .set('x-test-user-id', user.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(500);

    // Verify journal was rolled back
    const pendingJournals = await prisma.journal.findMany({
      where: { userId: user.id },
    });
    expect(pendingJournals.length).toBe(0);
  });
});
