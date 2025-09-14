import request from 'supertest';
import { app } from '../../src/index.ts';
import * as http from 'http';
import { PrismaClient, User } from '@prisma/client';
import { decrypt } from '../../src/lib/encryption.ts';

const prisma = new PrismaClient();
let server: http.Server;
let testUser: User;

describe('PUT /api/user/settings', () => {
  beforeAll((done) => {
    server = app.listen(0, done);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    testUser = await prisma.user.create({
      data: {
        email: `settings-user-${Date.now()}@test.com`,
        agreementsSigned: false,
        nightscoutUrl: 'https://initial.url',
        nightscoutToken: 'initial-encrypted-token',
      },
    });
  });

  afterAll(async (done) => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    server.close(done);
  });

  it('should return 401 Unauthorized if no user is authenticated', async () => {
    const response = await request(server).put('/api/user/settings').send({
      preferredUnits: 'MMOL',
    });
    expect(response.status).toBe(401);
  });

  it('should return 400 Bad Request for invalid data', async () => {
    const response = await request(server)
      .put('/api/user/settings')
      .set('x-test-user-id', testUser.id)
      .send({
        nightscoutUrl: 'not-a-valid-url',
      });
    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('should successfully update all settings and encrypt the token', async () => {
    const settingsPayload = {
      nightscoutUrl: 'https://my-nightscout-instance.com',
      nightscoutToken: 'my-secret-token-12345',
      preferredUnits: 'MMOL',
      agreementsSigned: true,
    };

    const response = await request(server)
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
    expect(updatedUser!.nightscoutToken).not.toBe(
      settingsPayload.nightscoutToken,
    );
    expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
      settingsPayload.nightscoutToken,
    );
  });

  it('should successfully clear optional fields when passed null', async () => {
    const settingsPayload = {
      nightscoutUrl: null,
      nightscoutToken: null,
    };

    const response = await request(server)
      .put('/api/user/settings')
      .set('x-test-user-id', testUser.id)
      .send(settingsPayload);
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser!.nightscoutUrl).toBeNull();
    expect(updatedUser!.nightscoutToken).toBeNull();
  });

  describe('API Security', () => {
    it('should be rate-limited to prevent abuse', async () => {
      const settingsPayload = { preferredUnits: 'MGDL' as const };
      const requests = [];
      const requestCount = 25; // Exceeds the planned limit of 20

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(server)
            .put('/api/user/settings')
            .set('x-test-user-id', testUser.id)
            .send(settingsPayload),
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitResponse = responses.find((res) => res.status === 429);

      expect(rateLimitResponse).toBeDefined();
      expect(rateLimitResponse?.body.error).toContain('Too many requests');
    });
  });
});
