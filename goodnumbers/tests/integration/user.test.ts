import session from 'supertest-session'; // FIX: Use supertest-session
import * as http from 'http';
import { PrismaClient, User } from '@prisma/client';
import { decrypt } from '../../src/lib/encryption.ts';
import type { Express } from 'express';
import { createApp } from '../../src/index.ts';

const prisma = new PrismaClient();
let server: http.Server;
let testUser: User;
let app: Express;
let agent: session.Session; // FIX: Use session agent
let csrfToken: string; // FIX: Variable for token

describe('PUT /api/user/settings', () => {
  beforeEach((done) => {
    app = createApp();
    server = app.listen(0, async () => {
      agent = session(app); // FIX: Initialize session agent
      await prisma.user.deleteMany();
      testUser = await prisma.user.create({
        data: {
          email: `settings-user-${Date.now()}@test.com`,
          agreementsSigned: false,
          nightscoutUrl: 'https://initial.url',
          nightscoutToken: 'initial-encrypted-token',
        },
      });
      // FIX: Fetch CSRF token before tests run
      const csrfRes = await agent.get('/api/csrf-token');
      csrfToken = csrfRes.body.csrfToken;
      done();
    });
  });

  afterEach((done) => {
    server.close(done);
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should return 401 Unauthorized if no user is authenticated', async () => {
    const response = await agent.put('/api/user/settings').send({
      preferredUnits: 'MMOL',
      _csrf: csrfToken,
    });
    expect(response.status).toBe(401);
  });

  it('should return 400 Bad Request for invalid data', async () => {
    const response = await agent
      .put('/api/user/settings')
      .set('x-test-user-id', testUser.id)
      .send({
        nightscoutUrl: 'not-a-valid-url',
        _csrf: csrfToken,
      });
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it("should return 403 Forbidden if the user has not signed agreements", async () => {
    // Arrange: Create a user who has NOT signed agreements
    const unagreedUser = await prisma.user.create({
      data: {
        email: `unagreed-user-${Date.now()}@test.com`,
        agreementsSigned: false,
      },
    });

    // Act
    const response = await agent
      .put("/api/user/settings")
      .set("x-test-user-id", unagreedUser.id) // Authenticate as this user
      .send({ preferredUnits: "MMOL", _csrf: csrfToken });

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("AGREEMENTS_NOT_SIGNED");
  });

  it('should successfully update all settings and encrypt the token', async () => {
    const settingsPayload = {
      nightscoutUrl: 'https://my-nightscout-instance.com',
      nightscoutToken: 'my-secret-token-12345',
      preferredUnits: 'MMOL',
      agreementsSigned: true,
      _csrf: csrfToken, // FIX: Include token
    };

    const response = await agent
      .put('/api/user/settings')
      .set('x-test-user-id', testUser.id)
      .send(settingsPayload);
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser!.agreementsSigned).toBe(true);
    expect(updatedUser!.nightscoutUrl).toBe(settingsPayload.nightscoutUrl);
    expect(updatedUser!.preferredUnits).toBe('MMOL');
    expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
      settingsPayload.nightscoutToken,
    );
  });
});
