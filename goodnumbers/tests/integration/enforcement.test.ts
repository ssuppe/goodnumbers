import request from 'supertest';
import { prisma } from '../../src/db';
import app from '../../src/index';
import type { User } from '@prisma/client';
import { connection as redisConnection } from '../../src/lib/queue';

describe('Agreement Enforcement Middleware', () => {
  let userWithNoAgreement: User;
  let userWithAgreement: User;
  let agent: request.SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    // Clean database
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test users
    [userWithNoAgreement, userWithAgreement] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'no-agreement@example.com',
          agreementsSigned: false,
        },
      }),
      prisma.user.create({
        data: {
          email: 'with-agreement@example.com',
          agreementsSigned: true,
        },
      }),
    ]);

    // Setup supertest agent to handle cookies for CSRF
    agent = request.agent(app);
    const tokenRes = await agent.get('/api/csrf-token');
    csrfToken = tokenRes.body.csrfToken;
  });

  afterAll(async () => {
    await prisma.journal.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
    await redisConnection.quit();
  });

  describe('Journal Routes Protection', () => {
    it('should return 403 Forbidden for a user without signed agreements', async () => {
      const response = await agent
        .post('/api/journals')
        .set('x-test-user-id', userWithNoAgreement.id)
        .set('x-csrf-token', csrfToken)
        .send({ title: 'My Journal' }); // Example payload

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
    });

    it('should return 201 Created for a user with signed agreements', async () => {
      const response = await agent
        .post('/api/journals')
        .set('x-test-user-id', userWithAgreement.id)
        .set('x-csrf-token', csrfToken)
        .send({ title: 'My Journal' }); // Example payload

      expect(response.status).toBe(201);
    });
  });

  describe('User Settings Route Protection', () => {
    const settingsPayload = {
      nightscoutUrl: 'https://my-nightscout.com',
      nightscoutToken: 'my-token',
      preferredUnits: 'MGDL',
    };

    it('should return 403 Forbidden for a user without signed agreements', async () => {
      const response = await agent
        .put('/api/user/settings')
        .set('x-test-user-id', userWithNoAgreement.id)
        .set('x-csrf-token', csrfToken) // <-- ADDED CSRF TOKEN
        .send(settingsPayload);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
    });

    it('should return 200 OK for a user with signed agreements', async () => {
      const response = await agent
        .put('/api/user/settings')
        .set('x-test-user-id', userWithAgreement.id)
        .set('x-csrf-token', csrfToken) // <-- ADDED CSRF TOKEN
        .send(settingsPayload);

      expect(response.status).toBe(200);
    });
  });

  describe('User RSS Token Route Protection', () => {
    it('should return 403 Forbidden for a user without signed agreements', async () => {
      const response = await agent
        .post('/api/user/regenerate-rss-token')
        .set('x-test-user-id', userWithNoAgreement.id)
        .set('x-csrf-token', csrfToken) // <-- ADDED CSRF TOKEN
        .send();

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
    });

    it('should return 200 OK for a user with signed agreements', async () => {
      const response = await agent
        .post('/api/user/regenerate-rss-token')
        .set('x-test-user-id', userWithAgreement.id)
        .set('x-csrf-token', csrfToken) // <-- ADDED CSRF TOKEN
        .send();

      expect(response.status).toBe(200);
    });
  });
});
