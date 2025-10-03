// file: goodnumbers/tests/unit/auth.allowlist.test.ts
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { User } from '@auth/core/types'; // Import the User type

// 1. Create a mutable object to hold our mock's implementation.
//    This object acts as a stable "bridge" between the test setup and the mock factory.
const fsPromisesMocks = {
  readFile: jest.fn(),
};

// 2. Use the stable bridge object in the mock factory.
//    Now, any module that imports 'fs/promises' via Jest's module loader will
//    receive this exact `fsPromisesMocks` object.
jest.unstable_mockModule('fs/promises', () => fsPromisesMocks);

describe('Auth.js signIn Callback', () => {
  beforeEach(() => {
    // Reset mocks and the module cache before each test to ensure isolation.
    fsPromisesMocks.readFile.mockClear();
    // jest.resetModules() is CRITICAL. It forces auth.ts to be re-imported,
    // picking up the freshly configured mock for each test.
    jest.resetModules();
  });

  it('should return TRUE for a user whose email is on the allowlist', async () => {
    // Arrange: Configure the mock's behavior for this specific test.
    const allowlistContent = 'user1@example.com\nuser2@example.com';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);

    // Act: Dynamically import the module under test *after* the mock is configured.
    const { authConfig } = await import('../../src/lib/auth.ts');
    const mockUser: User = { id: '1', email: 'user1@example.com' }; // Explicitly type mockUser
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });

    // Assert
    expect(result).toBe(true);
    // Also, assert that the file was read with the correct arguments.
    expect(fsPromisesMocks.readFile).toHaveBeenCalledWith(
      'config/allowed_emails.txt',
      'utf-8',
    );
  });

  it('should return FALSE for a user whose email is NOT on the allowlist', async () => {
    // Arrange
    const allowlistContent = 'user1@example.com\nuser2@example.com';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import('../../src/lib/auth.ts');

    // Act
    const mockUser: User = { id: '3', email: 'user3@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });

    // Assert
    expect(result).toBe(false);
  });

  it('should handle case-insensitivity correctly', async () => {
    // Arrange
    const allowlistContent = 'User.One@Example.COM';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import('../../src/lib/auth.ts');

    // Act
    const mockUser: User = { id: '1', email: 'user.one@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });

    // Assert
    expect(result).toBe(true);
  });

  it('should ignore comments and empty lines in the allowlist file', async () => {
    // Arrange
    const allowlistContent = `
      # This is a comment
      user1@example.com

      user2@example.com
    `;
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import('../../src/lib/auth.ts');

    // Act
    const allowedUser: User = { id: '1', email: 'user1@example.com' };
    const allowed = await authConfig.callbacks!.signIn!({ user: allowedUser });

    const deniedUser: User = { id: '3', email: '# This is a comment' };
    const denied = await authConfig.callbacks!.signIn!({ user: deniedUser });

    // Assert
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });

  it('should return FALSE if the allowlist file cannot be read (secure default)', async () => {
    // Arrange: Simulate a file system error.
    fsPromisesMocks.readFile.mockRejectedValue(new Error('File not found'));
    const { authConfig } = await import('../../src/lib/auth.ts');

    // Act
    const mockUser: User = { id: '1', email: 'user1@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });

    // Assert
    expect(result).toBe(false);
  });

  it('should return FALSE if the user has no email', async () => {
    // Arrange
    const allowlistContent = 'user1@example.com';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import('../../src/lib/auth.ts');

    // Act
    const mockUser: Partial<User> = { id: '1', email: null };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });

    // Assert
    expect(result).toBe(false);
  });
});
