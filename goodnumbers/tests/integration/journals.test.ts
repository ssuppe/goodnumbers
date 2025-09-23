import session from 'supertest-session';
import * as http from 'http';
import { PrismaClient, User } from '@prisma/client';
import type { Express } from 'express';
import { createApp } from '../../src/index';

const prisma = new PrismaClient();

let app: Express;
let server: http.Server;
let agent: session.Session;
let user1: User;
let csrfToken: string;

describe('POST /api/journals', () => {
  beforeEach((done) => {
    app = createApp();
    server = app.listen(0, async () => {
      agent = session(app);

      await prisma.user.deleteMany();
      user1 = await prisma.user.create({
        data: {
          email: `user1-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: 'https://user1.ns.com',
        },
      });

      const csrfRes = await agent.get('/api/csrf-token');
      csrfToken = csrfRes.body.csrfToken;

      done();
    });
  });

  afterEach((done) => {
    server.close(done);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return 401 Unauthorized if no user is authenticated', async () => {
    const res = await agent.post('/api/journals').send({ _csrf: csrfToken }); // FIX: Send token in body
    expect(res.status).toBe(401);
  });

  it('should return 403 Forbidden if the CSRF token is missing', async () => {
    const res = await agent
      .post('/api/journals')
      .set('x-test-user-id', user1.id)
      .send({}); // No '_csrf' field
    expect(res.status).toBe(403);
  });

  it('should return 201 Created if the user is authenticated and CSRF token is valid', async () => {
    const res = await agent
      .post('/api/journals')
      .set('x-test-user-id', user1.id)
      .send({ _csrf: csrfToken }); // FIX: Send token in body

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);
  });
});
