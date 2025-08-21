import 'dotenv/config';
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  afterEach,
} from '@jest/globals';
import { PrismaClient, User } from '@prisma/client';
import { AuthOptions } from 'next-auth';

// Mock the 'fs/promises' module before any other imports
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('Auth.js signIn Callback', () => {
  let testUser: User;
  let authConfig: AuthOptions; // Declare outside to be accessible in tests
  let prisma: PrismaClient; // Declare outside
  let mockedReadFile: jest.Mock; // Declare outside

  beforeEach(async () => {
    jest.resetModules(); // Reset modules before each test to clear cache

    // Re-import modules after reset
    const authModule = await import('../../src/lib/auth');
    authConfig = authModule.authConfig;

    const dbModule = await import('../../src/db');
    prisma = dbModule.prisma;

    const fsPromises = await import('fs/promises');
    mockedReadFile = fsPromises.readFile as jest.Mock;

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

  afterEach(() => {
    // Reset mocks after each test
    mockedReadFile.mockReset();
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it('should set agreementsSigned to true for an existing, allowed user who logs in', async () => {
    // Arrange: Mock the allowlist to contain the user's email
    mockedReadFile.mockResolvedValue('test.user@example.com\n'); // Added newline for correct split

    // Pre-condition check: ensure the flag is false
    const userBefore = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(userBefore?.agreementsSigned).toBe(false);

    // Act: Simulate the data Auth.js provides to the signIn callback
    const signInParams = {
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      },
      profile: {
        email: testUser.email!,
      },
    };

    // @ts-expect-error - We are simulating the call with only the necessary properties
    const result = await authConfig.callbacks.signIn(signInParams);

    // Assert: The callback should allow the sign-in
    expect(result).toBe(true);

    // Assert: The flag should now be true in the database
    const userAfter = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(userAfter?.agreementsSigned).toBe(true);
  });

  it('should return false if the user is not on the allowlist', async () => {
    // Arrange: Mock an allowlist that does NOT contain the user's email
    mockedReadFile.mockResolvedValue('another.user@example.com\n'); // Added newline for correct split

    const signInParams = {
      user: testUser,
      profile: { email: testUser.email! },
    };

    // Act
    // @ts-expect-error - Simulating the call
    const result = await authConfig.callbacks.signIn(signInParams);

    // Assert: The callback should deny sign-in
    expect(result).toBe(false);

    // Assert: The flag should remain false in the database
    const userAfter = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(userAfter?.agreementsSigned).toBe(false);
  });
});
