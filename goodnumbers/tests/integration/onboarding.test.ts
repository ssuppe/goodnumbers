import request from 'supertest';
import { app } from '../../src/index.ts';
import * as http from 'http';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();
let server: http.Server;

// We will add placeholder routes to the app instance FOR TESTING PURPOSES.
// This allows us to test the middleware in isolation.
import { protect } from '../../src/middleware/auth.ts';
import { enforceOnboarding } from '../../src/middleware/onboarding.ts';

app.get('/agreements', protect, (req, res) =>
  res.status(200).json({ page: 'agreements' }),
);
app.get('/setup-account', protect, (req, res) =>
  res.status(200).json({ page: 'setup-account' }),
);
app.get('/dashboard', protect, enforceOnboarding, (req, res) =>
  res.status(200).json({ page: 'dashboard' }),
);
app.get('/api/test-protected', protect, enforceOnboarding, (req, res) =>
  res.status(200).json({ success: true }),
);
app.post('/api/user/agreements', protect, async (req, res) => {
  // This is a simplified version of the real endpoint for the test
  if (!req.user?.id)
    return res.status(401).json({ error: 'Not authenticated' });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { agreementsSigned: true },
  });
  res.status(200).json({ success: true });
});

describe('Onboarding Enforcement Middleware', () => {
  let userNeedsAgreements: User;
  let userNeedsSetup: User;
  let userOnboarded: User;

  beforeEach(async () => {
    server = app.listen(0);
    await prisma.user.deleteMany();
    userNeedsAgreements = await prisma.user.create({
      data: {
        email: `needs-agreements-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
        agreementsSigned: false,
      },
    });
    userNeedsSetup = await prisma.user.create({
      data: {
        email: `needs-setup-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: null,
      },
    });
    userOnboarded = await prisma.user.create({
      data: {
        email: `onboarded-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
        agreementsSigned: true,
        nightscoutUrl: 'https://test.nightscout.com',
        preferredUnits: 'MGDL',
      },
    });
  });

  afterEach(async () => {
    server.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Scenario 1: User has NOT signed agreements', () => {
    const userId = () => userNeedsAgreements.id;

    it('should REDIRECT from a page route (/dashboard) to /agreements', async () => {
      const response = await request(server)
        .get('/dashboard')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/agreements');
    });

    it('should return a 403 FORBIDDEN from an API route (/api/test-protected)', async () => {
      const response = await request(server)
        .get('/api/test-protected')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('AGREEMENTS_NOT_SIGNED');
    });

    it('should PREVENT a redirect loop by allowing access to /agreements', async () => {
      const response = await request(server)
        .get('/agreements')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(200);
    });
  });

  describe('Scenario 2: User HAS signed agreements but NOT set up account', () => {
    const userId = () => userNeedsSetup.id;

    it('should REDIRECT from a page route (/dashboard) to /setup-account', async () => {
      const response = await request(server)
        .get('/dashboard')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/setup-account');
    });

    it('should return a 403 FORBIDDEN from an API route (/api/test-protected)', async () => {
      const response = await request(server)
        .get('/api/test-protected')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ACCOUNT_NOT_SETUP');
    });

    it('should PREVENT a redirect loop by allowing access to /setup-account', async () => {
      const response = await request(server)
        .get('/setup-account')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(200);
    });
  });

  describe('Scenario 3: User is fully onboarded', () => {
    const userId = () => userOnboarded.id;

    it('should ALLOW access to a page route (/dashboard)', async () => {
      const response = await request(server)
        .get('/dashboard')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(200);
    });

    it('should ALLOW access to an API route (/api/test-protected)', async () => {
      const response = await request(server)
        .get('/api/test-protected')
        .set('x-test-user-id', userId());
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/user/agreements', () => {
    it('should successfully update the user and set agreementsSigned to true', async () => {
      const userId = userNeedsAgreements.id;

      // Verify initial state
      const userBefore = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(userBefore?.agreementsSigned).toBe(false);

      // Make the API call
      const response = await request(server)
        .post('/api/user/agreements')
        .set('x-test-user-id', userId);
      expect(response.status).toBe(200);

      // Verify final state in database
      const userAfter = await prisma.user.findUnique({ where: { id: userId } });
      expect(userAfter?.agreementsSigned).toBe(true);
    });
  });
});
