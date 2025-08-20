import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import express from 'express';
import { PrismaClient, User } from '@prisma/client';
import { decrypt } from '../../src/lib/encryption';

// --- Mocking the authentication middleware with unstable_mockModule ---
let mockUserForAuth: User | null = null;

jest.unstable_mockModule('../../src/middleware/auth', () => ({
  protect: jest.fn(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (mockUserForAuth) {
        req.auth = {
          user: {
            id: mockUserForAuth.id,
            email: mockUserForAuth.email,
          },
        };
        next(); // Proceed if authenticated
      } else {
        // If not authenticated, send 401 and do NOT call next()
        res.status(401).json({ message: 'Not authorized' });
      }
    },
  ),
}));

// Dynamically import the router *after* the mock has been defined.
// This ensures the router gets the mocked 'protect' middleware.
let userRouter: express.Router;

// Setup Express app for testing
const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const request = supertest(app);

describe('User API', () => {
  beforeAll(async () => {
    // Dynamically import userRouter here, after the mock is set up
    const userModule = await import('../../src/routes/user');
    userRouter = userModule.default;
    app.use('/api/user', userRouter); // Wire up the router for testing
  });

  beforeEach(async () => {
    await prisma.journal.deleteMany(); // Cascade delete might handle this, but being explicit is safer
    await prisma.user.deleteMany();
    mockUserForAuth = null;
  });

  describe('PUT /api/user/settings', () => {
    it('should update user settings for an authenticated user and not return sensitive data', async () => {
      // Arrange
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          preferredUnits: 'MGDL', // Start with an initial value
        },
      });
      mockUserForAuth = user;

      const settingsPayload = {
        nightscoutUrl: 'https://my-nightscout-site.com',
        nightscoutToken: 'my-secret-token-123',
        preferredUnits: 'MMOL', // Update to a new value
      };

      // Act
      const response = await request
        .put('/api/user/settings')
        .send(settingsPayload);

      // Assert - API response
      expect(response.status).toBe(200);
      expect(response.body.preferredUnits).toBe('MMOL');
      expect(response.body.id).toBe(user.id);

      // --- SECURITY TEST IMPROVEMENT ---
      // We must explicitly test that NEITHER the token NOR the URL are returned
      // in the response body. This test now enforces our security policy.
      expect(response.body.nightscoutToken).toBeUndefined();
      expect(response.body.nightscoutUrl).toBeUndefined();

      // Assert - Database state
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.preferredUnits).toBe('MMOL');

      // Verify that the credentials in the DB are encrypted
      expect(dbUser!.nightscoutUrl).not.toBe(settingsPayload.nightscoutUrl);
      expect(dbUser!.nightscoutToken).not.toBe(settingsPayload.nightscoutToken);

      // Decrypt the values from the DB to confirm they match the original payload
      expect(decrypt(dbUser!.nightscoutUrl!)).toBe(
        settingsPayload.nightscoutUrl,
      );
      expect(decrypt(dbUser!.nightscoutToken!)).toBe(
        settingsPayload.nightscoutToken,
      );
    });

    it('should return 401 Unauthorized if the user is not authenticated', async () => {
      // Arrange: No user is set for the mock middleware (mockUserForAuth is null)
      const settingsPayload = {
        nightscoutUrl: 'https://my-nightscout-site.com',
        nightscoutToken: 'my-secret-token-123',
        preferredUnits: 'MMOL',
      };

      // Act
      const response = await request
        .put('/api/user/settings')
        .send(settingsPayload);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authorized');
    });

    it('should return 400 Bad Request for invalid URL', async () => {
      // Arrange
      const user = await prisma.user.create({
        data: { email: 'test2@example.com' },
      });
      mockUserForAuth = user;
      const invalidPayload = {
        nightscoutUrl: 'not-a-valid-url', // Invalid data
        nightscoutToken: 'a-token',
        preferredUnits: 'MGDL',
      };

      // Act
      const response = await request
        .put('/api/user/settings')
        .send(invalidPayload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.errors.nightscoutUrl).toBeDefined();
    });

    it('should return 400 Bad Request for invalid preferredUnits enum', async () => {
      // Arrange
      const user = await prisma.user.create({
        data: { email: 'test3@example.com' },
      });
      mockUserForAuth = user;
      const invalidPayload = {
        nightscoutUrl: 'https://a-valid-url.com',
        nightscoutToken: 'a-token',
        preferredUnits: 'INVALID_UNIT', // Invalid data
      };

      // Act
      const response = await request
        .put('/api/user/settings')
        .send(invalidPayload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.errors.preferredUnits).toBeDefined();
    });
  });

  describe('POST /api/user/regenerate-rss-token', () => {
    it('should regenerate the RSS token for an authenticated user', async () => {
      // Arrange
      const user = await prisma.user.create({
        data: {
          email: 'rss_test@example.com',
          name: 'RSS Test User',
          rssToken: 'initial-rss-token-123', // Set an initial token
        },
      });
      mockUserForAuth = user;

      // Get the initial token from the database
      const initialUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      const initialRssToken = initialUser!.rssToken;
      expect(initialRssToken).toBe('initial-rss-token-123');

      // Act
      const response = await request.post('/api/user/regenerate-rss-token');

      // Assert - API response
      expect(response.status).toBe(200);
      expect(response.body.newRssToken).toBeDefined();
      expect(response.body.newRssToken).not.toBe(initialRssToken);

      // Assert - Database state
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.rssToken).toBe(response.body.newRssToken);
      expect(dbUser!.rssToken).not.toBe(initialRssToken);
    });

    it('should return 401 Unauthorized if the user is not authenticated', async () => {
      // Arrange: No user is set for the mock middleware (mockUserForAuth is null)

      // Act
      const response = await request.post('/api/user/regenerate-rss-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Not authorized');
    });
  });
});
