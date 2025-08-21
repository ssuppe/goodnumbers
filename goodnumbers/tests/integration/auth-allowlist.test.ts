// goodnumbers/tests/integration/auth-allowlist.test.ts
import 'dotenv/config';
import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from '@jest/globals';

// Mock the 'fs/promises' module before any other imports (TOP LEVEL)
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
}));

// Import types for authConfig and prisma
import type { authConfig as AuthConfigType } from '../../src/lib/auth';
import type { PrismaClient } from '@prisma/client';

describe('Auth.js signIn Callback (Allowlist Logic)', () => {
  // OPENING DESCRIBE BLOCK
  // This user will be created by the Prisma adapter during the signIn call
  const testUser = {
    id: 'test-user-id-123',
    email: 'test.user@example.com',
    name: 'Test User',
  };

  // Spies for Prisma methods - Declare with `let`
  let prismaUserUpdateSpy: jest.SpyInstance;
  let prismaUserDeleteManySpy: jest.SpyInstance;
  let prismaDisconnectSpy: jest.SpyInstance;

  // Declare authConfig and prisma with `let` so they can be assigned in beforeEach
  let authConfig: AuthConfigType;
  let prisma: PrismaClient;

  beforeAll(() => {
    // Spies will be created in beforeEach after modules are reset
  });

  beforeEach(async () => {
    // Make beforeEach async
    jest.resetModules(); // Reset modules to clear the cache in auth.ts

    // RE-APPLY MOCK BEFORE IMPORTING MODULES THAT USE IT
    jest.unstable_mockModule('fs/promises', () => ({
      readFile: jest.fn(),
    }));

    // Re-import modules after reset
    const authModule = await import('../../src/lib/auth');
    authConfig = authModule.authConfig;

    const dbModule = await import('../../src/db');
    prisma = dbModule.prisma;

    // Re-initialize mockedReadFile after module reset
    const fsPromisesModule = await import('fs/promises');
    mockedReadFile = fsPromisesModule.readFile as jest.Mock;

    // Re-initialize spies after modules are re-imported
    prismaUserUpdateSpy = jest.spyOn(prisma.user, 'update');
    prismaUserDeleteManySpy = jest.spyOn(prisma.user, 'deleteMany');
    prismaDisconnectSpy = jest.spyOn(prisma, '$disconnect');
  });

  afterEach(async () => {
    // Reset mocks and clear database after each test
    mockedReadFile.mockReset();
    prismaUserUpdateSpy.mockReset(); // Reset spy
    prismaUserDeleteManySpy.mockReset(); // Reset spy
    prismaDisconnectSpy.mockReset(); // Reset spy
  });

  afterAll(async () => {
    // Restore original implementations after all tests
    prismaUserUpdateSpy.mockRestore();
    prismaUserDeleteManySpy.mockRestore();
    prismaDisconnectSpy.mockRestore();
  });

  it('should return true and allow sign-in for a user on the allowlist', async () => {
    // Arrange: Mock the allowlist file to contain the user\'s email
    mockedReadFile.mockResolvedValue(
      'test.user@example.com\nanother@example.com',
    );
    prismaUserUpdateSpy.mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      agreementsSigned: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const signInParams = {
      user: testUser,
      profile: { email: testUser.email! },
    };

    // Act
    // @ts-expect-error: Auth.js callback parameters are not fully typed in @auth/core
    const result = await authConfig.callbacks.signIn(signInParams);

    // Assert
    expect(result).toBe(true);
    expect(prismaUserUpdateSpy).toHaveBeenCalledWith({
      where: { id: testUser.id },
      data: { agreementsSigned: true },
    });
  });

  it('should perform a case-insensitive check and allow a user', async () => {
    // Arrange: The allowlist has a different case than the user\'s email
    mockedReadFile.mockResolvedValue('Test.User@example.com\n');
    prismaUserUpdateSpy.mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      agreementsSigned: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const signInParams = {
      user: testUser,
      profile: { email: 'test.user@example.com' },
    };

    // Act
    // @ts-expect-error: Auth.js callback parameters are not fully typed in @auth/core
    const result = await authConfig.callbacks.signIn(signInParams);

    // Assert
    expect(result).toBe(true);
    expect(prismaUserUpdateSpy).toHaveBeenCalledWith({
      where: { id: testUser.id },
      data: { agreementsSigned: true },
    });
  });

  it('should return false and deny sign-in for a user NOT on the allowlist', async () => {
    // Arrange: The allowlist does not contain the user\'s email
    mockedReadFile.mockResolvedValue('another.user@example.com');
    // No need to mock prisma.user.update here as it should not be called

    const signInParams = {
      user: testUser,
      profile: { email: testUser.email! },
    };

    // Act
    // @ts-expect-error: Auth.js callback parameters are not fully typed in @auth/core
    const result = await authConfig.callbacks.signIn(signInParams);

    // Assert
    expect(result).toBe(false);
    expect(prismaUserUpdateSpy).not.toHaveBeenCalled(); // Ensure update is not called
  });

  it('should return false and deny all sign-ins if the allowlist file cannot be read', async () => {
    // Arrange: Mock the file read to throw an error
    mockedReadFile.mockRejectedValue(new Error('File not found'));
    // No need to mock prisma.user.update here as it should not be called

    // We don\'t even need to create a user, as it should fail for everyone
    const signInParams = {
      user: testUser,
      profile: { email: testUser.email! },
    };

    // Act
    // @ts-expect-error: Auth.js callback parameters are not fully typed in @auth/core
    const result = await authConfig.callbacks.signIn(signInParams);

    // Assert
    expect(result).toBe(false);
    expect(prismaUserUpdateSpy).not.toHaveBeenCalled(); // Ensure update is not called
  });
});
