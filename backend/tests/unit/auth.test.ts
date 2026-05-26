import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Setup mocks using ALIASES
vi.mock('@src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@src/lib/auth-utils.js', () => ({
  authUtils: {
    isEmailAllowed: vi.fn(),
  },
}));

// 2. Import using ALIASES
import { prisma as prismaMock } from '@src/lib/prisma.js';
import { authUtils as authUtilsMock } from '@src/lib/auth-utils.js';
import * as passwords from '@src/lib/passwords.js';

describe('Auth.js authorize Callback Logic', () => {
  let authorize: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // 3. Dynamically import the standalone authorize function
    const authModule = await import('@src/lib/auth.js');
    authorize = authModule.authorize;
    
    // Default mock behavior
    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(true);
  });

  it('should return null if email or password is missing', async () => {
    expect(await authorize({ email: 'test@example.com' })).toBeNull();
    expect(await authorize({ password: 'password' })).toBeNull();
  });

  it('should return null if password is too short', async () => {
    const result = await authorize({
      email: 'test@example.com',
      password: 'short',
    });
    expect(result).toBeNull();
  });

  it('should return null if email is not on allowlist', async () => {
    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(false);

    const result = await authorize({
      email: 'hacker@example.com',
      password: 'valid_password',
    });
    expect(result).toBeNull();
  });

  it('should auto-register a new user if on allowlist and action is register', async () => {
    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);
    vi.mocked(prismaMock.user.create).mockResolvedValue({
      id: 'new-id',
      email: 'newuser@example.com',
    } as any);

    const result = await authorize({
      email: 'newuser@example.com',
      password: 'secure-password',
      action: 'register',
    });

    expect(result).toEqual({ id: 'new-id', email: 'newuser@example.com' });
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it('should return null if trying to register an existing user', async () => {
    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      id: 'existing-id',
    } as any);

    const result = await authorize({
      email: 'existing@example.com',
      password: 'password_123',
      action: 'register',
    });
    expect(result).toBeNull();
  });

  it('should return null if trying to login a non-existent user', async () => {
    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

    const result = await authorize({
      email: 'newuser@example.com',
      password: 'password_123',
      action: 'login',
    });
    expect(result).toBeNull();
  });

  it('should verify password for existing user', async () => {
    const hashedPassword = passwords.hashPassword('correct-password');

    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      id: 'existing-id',
      email: 'existing@example.com',
      password: hashedPassword,
    } as any);

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
    vi.mocked(authUtilsMock.isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      id: 'legacy-id',
      email: 'legacy@example.com',
      password: null, // No password yet
    } as any);
    vi.mocked(prismaMock.user.update).mockResolvedValue({
      id: 'legacy-id',
      email: 'legacy@example.com',
      password: 'new-hash',
    } as any);

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
