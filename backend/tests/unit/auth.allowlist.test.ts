import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@auth/core/types';

const fsPromisesMocks = {
  readFile: vi.fn(),
};

vi.mock('fs/promises', () => fsPromisesMocks);

describe('Auth.js signIn Callback', () => {
  beforeEach(() => {
    fsPromisesMocks.readFile.mockClear();
    vi.resetModules(); // CORRECT: Reset modules before each test
  });

  it('should return TRUE for a user whose email is on the allowlist', async () => {
    const allowlistContent = 'user1@example.com\nuser2@example.com';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);

    const { authConfig } = await import('@src/lib/auth.ts');
    const mockUser: User = { id: '1', email: 'user1@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });

    expect(result).toBe(true);
    expect(fsPromisesMocks.readFile).toHaveBeenCalledWith(
      'config/allowed_emails.txt',
      'utf-8',
    );
  });

  it('should return FALSE for a user whose email is NOT on the allowlist', async () => {
    const allowlistContent = 'user1@example.com\nuser2@example.com';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);

    const { authConfig } = await import('@src/lib/auth.ts');
    const mockUser: User = { id: '3', email: 'user3@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });
    expect(result).toBe(false);
  });

  it('should handle case-insensitivity correctly', async () => {
    const allowlistContent = 'User.One@Example.COM';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);

    const { authConfig } = await import('@src/lib/auth.ts');
    const mockUser: User = { id: '1', email: 'user.one@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });
    expect(result).toBe(true);
  });

  it('should ignore comments and empty lines in the allowlist file', async () => {
    const allowlistContent = "\n      # This is a comment\n      user1@example.com\n\n      user2@example.com\n    ";
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);

    const { authConfig } = await import('@src/lib/auth.ts');
    const allowedUser: User = { id: '1', email: 'user1@example.com' };
    const allowed = await authConfig.callbacks!.signIn!({ user: allowedUser });
    const deniedUser: User = { id: '3', email: '# This is a comment' };
    const denied = await authConfig.callbacks!.signIn!({ user: deniedUser });
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });

  it('should return FALSE if the allowlist file cannot be read (secure default)', async () => {
    fsPromisesMocks.readFile.mockRejectedValue(new Error('File not found'));

    const { authConfig } = await import('@src/lib/auth.ts');
    const mockUser: User = { id: '1', email: 'user1@example.com' };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser });
    expect(result).toBe(false);
  });

  it('should return FALSE if the user has no email', async () => {
    const allowlistContent = 'user1@example.com';
    fsPromisesMocks.readFile.mockResolvedValue(allowlistContent);

    const { authConfig } = await import('@src/lib/auth.ts');
    const mockUser: Partial<User> = { id: '1', email: null };
    const result = await authConfig.callbacks!.signIn!({ user: mockUser as User });
    expect(result).toBe(false);
  });
});
