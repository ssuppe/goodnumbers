import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as http from 'http';
import type { Express } from 'express';
import session from 'supertest-session';
import type { User, Journal, GlycemicEventCluster } from '@goodnumbers/types';
import { prisma } from '../../src/lib/prisma.js';
import crypto from 'crypto';

// 1. Mock Gemini Chat Services
const mockGenerateChatResponse = vi.fn();
const mockSynthesizeChatInsight = vi.fn();

vi.mock('../../src/lib/ai/gemini.js', () => ({
  generateClusterAIInsight: vi.fn(),
  generateExecutiveSummary: vi.fn(),
  generateChatResponse: mockGenerateChatResponse,
  synthesizeChatInsight: mockSynthesizeChatInsight,
}));

describe('Journal Chat and Synthesis API Routes', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let user: User;
  let journal: Journal;
  let cluster: GlycemicEventCluster;
  let csrfToken: string;

  beforeEach(async () => {
    const { createApp } = await import('../../src/index.js');
    app = createApp();
    server = app.listen(0);
    agent = session(app);

    // Create database records
    user = await prisma.user.create({
      data: {
        email: `chat-user-${crypto.randomUUID()}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://user.ns.com',
      },
    });

    journal = await prisma.journal.create({
      data: {
        userId: user.id,
        status: 'COMPLETE',
      },
    });

    cluster = await prisma.glycemicEventCluster.create({
      data: {
        journalId: journal.id,
        eventType: 'hyper',
        eventCount: 3,
        meanTimeMinutes: 720,
        clusterDataJson: JSON.stringify({
          id: 'c-1',
          type: 'hyper',
          avgStartMinute: 720,
          avgDurationMinutes: 60,
          eventCount: 3,
          activeDays: [1, 2],
          events: [],
        }),
      },
    });

    // Fetch CSRF token
    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
    // Clean up DB records
    await prisma.glycemicEventCluster.deleteMany({
      where: { journalId: journal.id },
    });
    await prisma.journal.delete({ where: { id: journal.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  describe('POST /api/journals/:id/clusters/:clusterId/chat', () => {
    it('returns 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${cluster.id}/chat`)
        .send({ message: 'Hello', chatHistory: [], _csrf: csrfToken });

      expect(res.status).toBe(401);
    });

    it('returns 400 Bad Request if the request body is missing parameters', async () => {
      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${cluster.id}/chat`)
        .set('x-test-user-id', user.id)
        .send({ _csrf: csrfToken }); // Missing message and chatHistory

      expect(res.status).toBe(400);
    });

    it('returns 404 Not Found if the cluster does not exist', async () => {
      const badClusterId = 'cuid12345678901234567890'; // Valid CUID format but non-existent
      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${badClusterId}/chat`)
        .set('x-test-user-id', user.id)
        .send({ message: 'Hello', chatHistory: [], _csrf: csrfToken });

      expect(res.status).toBe(404);
    });

    it('returns 200 OK with the AI response on success', async () => {
      mockGenerateChatResponse.mockResolvedValue('Mocked AI coach response.');

      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${cluster.id}/chat`)
        .set('x-test-user-id', user.id)
        .send({
          message: 'I spiked after lunch',
          chatHistory: [],
          _csrf: csrfToken,
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe('Mocked AI coach response.');
      expect(mockGenerateChatResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/journals/:id/clusters/:clusterId/save-insight', () => {
    it('returns 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${cluster.id}/save-insight`)
        .send({ chatHistory: [], _csrf: csrfToken });

      expect(res.status).toBe(401);
    });

    it('returns 404 Not Found if the cluster or journal ownership mismatches', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: `other-user-${crypto.randomUUID()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: 'https://other.ns.com',
        },
      });

      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${cluster.id}/save-insight`)
        .set('x-test-user-id', otherUser.id)
        .send({ chatHistory: [], _csrf: csrfToken });

      expect(res.status).toBe(404);

      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('returns 200 OK with synthesized markdown summary', async () => {
      mockSynthesizeChatInsight.mockResolvedValue(
        '> "I realized I spiked post lunch."\n* **Resolution:** Bolus earlier.',
      );

      const res = await agent
        .post(`/api/journals/${journal.id}/clusters/${cluster.id}/save-insight`)
        .set('x-test-user-id', user.id)
        .send({
          chatHistory: [
            { role: 'user', content: 'Lunch spike' },
            { role: 'model', content: 'Did you bolus?' },
          ],
          _csrf: csrfToken,
        });

      expect(res.status).toBe(200);
      expect(res.body.synthesizedInsight).toBe(
        '> "I realized I spiked post lunch."\n* **Resolution:** Bolus earlier.',
      );
      expect(mockSynthesizeChatInsight).toHaveBeenCalledTimes(1);
    });
  });
});
