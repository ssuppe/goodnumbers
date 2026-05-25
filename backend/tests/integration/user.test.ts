// file: backend/tests/integration/user.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import type { Express } from 'express';
import session from 'supertest-session';
import { prisma } from '../../src/lib/prisma.js';
import { decrypt } from '@src/lib/encryption.ts';
import crypto from 'crypto';

describe('/api/user', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let csrfToken: string;

  beforeEach(async () => {
    const { createApp } = await import('../../src/index.js');
    app = createApp();
    server = app.listen(0);
    agent = session(app);

    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  describe('PUT /settings', () => {
    it('should return 401 Unauthorized if no user is authenticated', async () => {
      const res = await agent
        .put('/api/user/settings')
        .send({ _csrf: csrfToken });
      expect(res.status).toBe(401);
    });

    it('should return 403 Forbidden if the user has not signed agreements', async () => {
      const unagreedUser = await prisma.user.create({
        data: {
          email: `unagreed-user-${crypto.randomUUID()}@test.com`,
          agreementsSigned: false, // Explicitly false for this test case
        },
      });

      const res = await agent
        .put('/api/user/settings')
        .set('x-test-user-id', unagreedUser.id)
        .send({ preferredUnits: 'MMOL', _csrf: csrfToken });

      expect(res.status).toBe(403);
    });

    it('should return 400 Bad Request for invalid data', async () => {
      // THIS IS THE FIX: This user MUST have agreements signed to pass authorization
      const user = await prisma.user.create({
        data: {
          email: `test-${crypto.randomUUID()}@test.com`,
          agreementsSigned: true,
        },
      });
      const res = await agent
        .put('/api/user/settings')
        .set('x-test-user-id', user.id)
        .send({ nightscoutUrl: 'not-a-valid-url', _csrf: csrfToken });
      expect(res.status).toBe(400);
    });

    it('should successfully update all settings and encrypt the token', async () => {
      const user = await prisma.user.create({
        data: {
          email: `settings-user-${crypto.randomUUID()}@test.com`,
          agreementsSigned: true,
        },
      });
      const payload = {
        nightscoutUrl: 'https://my-nightscout-instance.com',
        nightscoutToken: 'my-secret-token-12345',
        preferredUnits: 'MMOL',
        _csrf: csrfToken,
      };

      const res = await agent
        .put('/api/user/settings')
        .set('x-test-user-id', user.id)
        .send(payload);
      expect(res.status).toBe(200);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser!.nightscoutUrl).toBe(payload.nightscoutUrl);
      expect(updatedUser!.preferredUnits).toBe('MMOL');
      expect(updatedUser!.nightscoutTokenLast3).toBe('12345'.slice(-3));
      expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
        payload.nightscoutToken,
      );
    });
  });
});
