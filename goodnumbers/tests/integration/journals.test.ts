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

  it.skip("should return 201 Created and status PENDING for a valid request", async () => {
    const res = await agent
      .post("/api/journals")
      .set("x-test-user-id", user1.id)
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(201);
    expect(res.body.journal).toBeDefined();
    expect(res.body.journal.userId).toBe(user1.id);
    // THIS IS THE NEW ASSERTION: We verify the initial state is PENDING.
    expect(res.body.journal.status).toBe("PENDING");
  });
});

// Test suite for the new GET /api/journals/:id/status endpoint
describe("GET /api/journals/:id/status", () => {
  let user1;
  let user2;
  let journal1;

  beforeEach(async () => {
    // Create distinct users and a journal for user1
    [user1, user2] = await prisma.user.createManyAndReturn({
      data: [
        {
          email: `user1-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: "https://user1.ns.com",
        },
        {
          email: `user2-${Date.now()}@test.com`,
          agreementsSigned: true,
          nightscoutUrl: "https://user2.ns.com",
        },
      ],
    });
    journal1 = await prisma.journal.create({
      data: {
        userId: user1.id,
        status: "PROCESSING",
        progress: 50,
        statusMessage: "Analyzing data...",
      },
    });
  });

  it("should return 401 Unauthorized if no user is authenticated", async () => {
    const res = await agent.get(`/api/journals/${journal1.id}/status`);
    expect(res.status).toBe(401);
  });

  it("should return 400 Bad Request for a malformed journal ID", async () => {
    const malformedId = "this-is-not-a-cuid";
    const res = await agent
      .get(`/api/journals/${malformedId}/status`)
      .set("x-test-user-id", user1.id);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain("Invalid journal ID format.");
  });

  it("should return 404 Not Found for a non-existent journal ID", async () => {
    const nonExistentId = "clxxxxxxxxxxxxxxxxxxxxxx"; // A valid CUID that doesn't exist
    const res = await agent
      .get(`/api/journals/${nonExistentId}/status`)
      .set("x-test-user-id", user1.id);
    expect(res.status).toBe(404);
  });

  it("should return 404 Not Found when requesting a journal owned by another user", async () => {
    const res = await agent
      .get(`/api/journals/${journal1.id}/status`) // journal1 is owned by user1
      .set("x-test-user-id", user2.id); // but we are authenticated as user2
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Journal not found.");
  });

  it("should return 200 OK with the correct status for a journal owned by the user", async () => {
    const res = await agent
      .get(`/api/journals/${journal1.id}/status`)
      .set("x-test-user-id", user1.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "PROCESSING",
      progress: 50,
      statusMessage: "Analyzing data...",
    });
  });
});
