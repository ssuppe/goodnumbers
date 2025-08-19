// file: goodnumbers/tests/integration/auth.test.ts
import 'dotenv/config';
import { PrismaClient, User } from '@prisma/client';
import { authConfig } from '../../src/lib/auth'; // We will test our actual config

// Mock the getAllowedEmails function to isolate our test
// For this test, we assume the user is always on the allowlist.
jest.mock('../../src/lib/auth', () => {
  const originalModule = jest.requireActual('../../src/lib/auth');
  return {
    ...originalModule,
    // This mock ensures our test doesn't depend on the file system.
    __esModule: true,
    // Mock the specific named export

    getAllowedEmails: jest
      .fn()
      .mockResolvedValue(new Set(['test.user@example.com'])),
  };
});

describe('Auth.js Callbacks', () => {
  let prisma: PrismaClient;
  let testUser: User;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    // Clean up and create a fresh user before each test
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: {
        email: 'test.user@example.com',
        name: 'Test User',
        agreementsSigned: false, // Explicitly start as false
      },
    });
  });

  afterAll(async () => {
    // Guard against running in a non-test environment
    if (process.env.NODE_ENV === 'test') {
      await prisma.user.deleteMany({});
    }
    await prisma.$disconnect();
  });

  describe('signIn callback', () => {
    it('should set agreementsSigned to true for an existing user who logs in', async () => {
      // Pre-condition check: ensure the flag is false before the test runs
      const userBefore = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(userBefore?.agreementsSigned).toBe(false);

      // Simulate the data Auth.js provides to the signIn callback
      // This includes the full `user` object with the `id` as the Prisma adapter would provide it.
      const signInParams = {
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        account: null, // Not needed for our logic
        profile: {
          email: testUser.email!,
        },
      };

      // Directly call the signIn function from our auth configuration
      if (authConfig.callbacks && authConfig.callbacks.signIn) {
        // @ts-expect-error - We are simulating the call with only the necessary properties
        const result = await authConfig.callbacks.signIn(signInParams);

        // The callback should return true to allow the sign-in to complete
        expect(result).toBe(true);
      } else {
        throw new Error('signIn callback is not defined in authConfig');
      }

      // Post-condition check: verify the flag was updated in the database
      const userAfter = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(userAfter?.agreementsSigned).toBe(true);
    });

    it('should return false if the user is not on the allowlist', async () => {
      // Arrange: Set up a user whose email is NOT on the mocked allowlist
      const disallowedUser = {
        id: 'disallowed-id',
        email: 'disallowed.user@example.com',
        name: 'Disallowed User',
      };
      const signInParams = {
        user: disallowedUser,
        account: null,
        profile: { email: disallowedUser.email },
      };

      // Act: Directly call the signIn function
      if (authConfig.callbacks && authConfig.callbacks.signIn) {
        // @ts-expect-error Simulating call
        const result = await authConfig.callbacks.signIn(signInParams);
        // Assert: The callback should return false
        expect(result).toBe(false);
      } else {
        throw new Error('signIn callback is not defined in authConfig');
      }
    });
  });
});
