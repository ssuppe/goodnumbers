import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Setup mocks BEFORE any imports
// We use absolute paths to ensure Vitest correctly intercepts the modules
// regardless of how they are imported (relative vs aliased).

vi.mock('/home/clark/dev/goodnumbers-clean/backend/src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('/home/clark/dev/goodnumbers-clean/backend/src/lib/auth-utils.js', () => ({
  isEmailAllowed: vi.fn(),
}));

// 2. Now import what we need
import { prisma as prismaMock } from '../../src/lib/prisma.js';
import { isEmailAllowed } from '../../src/lib/auth-utils.js';
import { hashPassword } from '../../src/lib/passwords.js';
import { authConfig } from '../../src/lib/auth.js';
import type { User as AuthUser } from '@auth/core/types';

describe('Auth.js authorize Callback', () => {
  // Directly access the authorize function from the provider
  const authorize = (
    authConfig.providers[0] as {
      authorize: (
        credentials: Record<string, unknown>,
      ) => Promise<AuthUser | null>;
    }
  ).authorize;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if email or password is missing', async () => {
    expect(await authorize({ email: 'test@example.com' })).toBeNull();
    expect(await authorize({ password: 'password' })).toBeNull();
  });

  it('should return null if email is not on allowlist', async () => {
    vi.mocked(isEmailAllowed).mockResolvedValue(false);

    const result = await authorize({
      email: 'hacker@example.com',
      password: 'any',
    });
    expect(result).toBeNull();
  });

  it('should auto-register a new user if on allowlist and action is register', async () => {
    vi.mocked(isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);
    vi.mocked(prismaMock.user.create).mockResolvedValue({
      id: 'new-id',
      email: 'newuser@example.com',
    } as unknown as AuthUser);

    const result = await authorize({
      email: 'newuser@example.com',
      password: 'secure-password',
      action: 'register',
    });

    expect(result).toEqual({ id: 'new-id', email: 'newuser@example.com' });
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it('should return null if trying to register an existing user', async () => {
    vi.mocked(isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      id: 'existing-id',
    } as unknown as AuthUser);

    const result = await authorize({
      email: 'existing@example.com',
      password: 'password',
      action: 'register',
    });
    expect(result).toBeNull();
  });

  it('should return null if trying to login a non-existent user', async () => {
    vi.mocked(isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

    const result = await authorize({
      email: 'newuser@example.com',
      password: 'password',
      action: 'login',
    });
    expect(result).toBeNull();
  });

  it('should verify password for existing user', async () => {
    const hashedPassword = hashPassword('correct-password');

    vi.mocked(isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      id: 'existing-id',
      email: 'existing@example.com',
      password: hashedPassword,
    } as unknown as AuthUser);

    // Correct password
    const successResult = await authorize({
      email: 'existing@example.com',
      password: 'correct-password',
      action: 'login',
    });
    expect(successResult).not.toBeNull();
    expect(successResult?.id).toBe('existing-id');

    // Wrong password
    const failResult = await authorize({
      email: 'existing@example.com',
      password: 'wrong-password',
      action: 'login',
    });
    expect(failResult).toBeNull();
  });

  it('should update password for legacy OAuth user without password', async () => {
    vi.mocked(isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      id: 'legacy-id',
      email: 'legacy@example.com',
      password: null, // No password yet
    } as unknown as AuthUser);
    vi.mocked(prismaMock.user.update).mockResolvedValue({
      id: 'legacy-id',
      email: 'legacy@example.com',
      password: 'new-hash',
    } as unknown as AuthUser);

    const result = await authorize({
      email: 'legacy@example.com',
      password: 'new-password',
      action: 'login',
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('legacy-id');
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});
