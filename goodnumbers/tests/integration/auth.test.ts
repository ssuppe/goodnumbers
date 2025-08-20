// auth.test.ts

import "dotenv/config";
import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { PrismaClient, User } from "@prisma/client";
import { authConfig } from "../../src/lib/auth"; // We will test our actual config

// Mock the 'fs/promises' module
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
}));




// Cast the mocked function to make TypeScript happy
let mockedReadFile: jest.Mock; // Declare it here, assign in beforeAll

describe("Auth.js Callbacks", () => {
  let prisma: PrismaClient;
  let testUser: User;

  beforeAll(async () => {
    const fsPromises = await import('fs/promises');
    mockedReadFile = fsPromises.readFile as jest.Mock;
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    // Clean up and create a fresh user before each test
    await prisma.user.deleteMany({});
    testUser = await prisma.user.create({
      data: {
        email: "test.user @example.com",
        name: "Test User",
        agreementsSigned: false, // Explicitly start as false
      },
    });
  });

  afterAll(async () => {
    // Guard against running in a non-test environment
    if (process.env.NODE_ENV === "test") {
      await prisma.user.deleteMany({});
    }
    await prisma.$disconnect();
  });

  describe("signIn callback", () => {
    it("should set agreementsSigned to true for an existing user who logs in", async () => {
      // Configure the mock to simulate the user being on the allowlist
      mockedReadFile.mockResolvedValue('test.user @example.comnanother.user@example.com');

      // Pre-condition check: ensure the flag is false before the test runs
      const userBefore = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(userBefore?.agreementsSigned).toBe(false);

      const signInParams = {
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        account: null,
        profile: {
          email: testUser.email!,
        },
      };

      if (authConfig.callbacks && authConfig.callbacks.signIn) {
        // @ts-ignore - We are simulating the call with only the necessary properties
        const result = await authConfig.callbacks.signIn(signInParams);
        expect(result).toBe(true);
      } else {
        throw new Error("signIn callback is not defined in authConfig");
      }

      // Post-condition check: verify the flag was updated in the database
      const userAfter = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(userAfter?.agreementsSigned).toBe(true);
    });

    it("should return false if the user is not on the allowlist", async () => {
      // Configure the mock to have an allowlist that does NOT include the user
      mockedReadFile.mockResolvedValue('allowed.user @example.com');

      const disallowedUser = {
        id: "disallowed-id",
        email: "disallowed.user @example.com",
        name: "Disallowed User",
      };
      const signInParams = {
        user: disallowedUser,
        account: null,
        profile: {
          email: disallowedUser.email,
        },
      };

      if (authConfig.callbacks && authConfig.callbacks.signIn) {
        // @ts-ignore
        const result = await authConfig.callbacks.signIn(signInParams);
        // The callback should return false to deny the sign-in
        expect(result).toBe(false);
      } else {
        throw new Error("signIn callback is not defined in authConfig");
      }
    });
  });
});
