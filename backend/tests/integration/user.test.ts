// --- START: IN-MEMORY DATABASE SETUP ---
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
// FIX: Import PrismaClient directly from its generated source file, not the package's entry point.
import { PrismaClient } from '../../../packages/types/src/generated/client/index.js';

// Generate a unique database file for this test run.
const dbFile = `test-user-${crypto.randomUUID()}.db`;
const dbPath = path.resolve('backend', dbFile);
process.env.DATABASE_URL = `file:${dbFile}`;

// --- END: IN-MEMORY DATABASE SETUP ---

// --- START: SINGLETON MOCK PATTERN ---
// 1. Create a single, shared instance of the real PrismaClient, configured for our in-memory DB.
const prisma = new PrismaClient();

// 2. Mock the prisma library to ALWAYS return this single instance.
vi.mock('@src/lib/prisma.js', () => ({
  prisma: prisma,
}));
// --- END: SINGLETON MOCK PATTERN ---

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
  afterAll,
} from 'vitest';
import * as http from 'http';
import type { Express } from 'express';
import session from 'supertest-session';
import type { User } from '@goodnumbers/types';
import { decrypt } from '@src/lib/encryption.ts';

describe('PUT /api/user/settings', () => {
  let app: Express;
  let server: http.Server;
  let agent: session.Session;
  let testUser: User;
  let csrfToken: string;

  beforeAll(() => {
    // Apply migrations once for the entire test file
    execSync('npx prisma migrate deploy');
  });

  afterAll(() => {
    // Clean up the database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  beforeEach(async () => {
    // Note: We no longer need to import prisma here; it's already in scope.
    const { createApp } = await import('@src/index.js');

    // Clear data before each test
    await prisma.user.deleteMany({});

    app = createApp();
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    agent = session(app);

    testUser = await prisma.user.create({
      data: {
        email: `settings-user-${Date.now()}@test.com`,
        agreementsSigned: true,
      },
    });
    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
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

  it('should return 403 Forbidden if the user has not signed agreements', async () => {
    const unagreedUser = await prisma.user.create({
      data: {
        email: `unagreed-user-${Date.now()}@test.com`,
        agreementsSigned: false,
      },
    });

    const response = await agent
      .put('/api/user/settings')
      .set('x-test-user-id', unagreedUser.id)
      .send({ preferredUnits: 'MMOL', _csrf: csrfToken });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
  });

  it('should successfully update all settings and encrypt the token', async () => {
    const settingsPayload = {
      nightscoutUrl: 'https://my-nightscout-instance.com',
      nightscoutToken: 'my-secret-token-12345',
      preferredUnits: 'MMOL',
      _csrf: csrfToken,
    };

    const response = await agent
      .put('/api/user/settings')
      .set('x-test-user-id', testUser.id)
      .send(settingsPayload);
    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser!.nightscoutUrl).toBe(settingsPayload.nightscoutUrl);
    expect(updatedUser!.preferredUnits).toBe('MMOL');
    expect(decrypt(updatedUser!.nightscoutToken!)).toBe(
      settingsPayload.nightscoutToken,
    );
  });
});
