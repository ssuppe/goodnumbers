/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { authorize } from '../../src/lib/auth.js';
import { prisma } from '../../src/lib/prisma.js';
import { authUtils } from '../../src/lib/auth-utils.js';

// We mock the database and utils to isolate the logic
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/auth-utils.js', () => ({
  authUtils: {
    isEmailAllowed: vi.fn(),
  },
}));

describe('Defensive Auth Guardrails', () => {
  it('GUARDRAIL: should handle allowlist checks case-insensitively', async () => {
    const mixedCaseEmail = 'User@Example.com';
    const lowerCaseEmail = 'user@example.com';

    // Setup: Allowlist contains lowercase, user provides MixedCase
    vi.mocked(authUtils.isEmailAllowed).mockImplementation(
      async ({ email }) => {
        return email.toLowerCase() === lowerCaseEmail;
      },
    );

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // New user
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: '123',
      email: lowerCaseEmail,
      rssToken: 'token-123',
    } as any);

    const result = await authorize({
      email: mixedCaseEmail,
      password: 'password123',
      action: 'register',
    });

    expect(result).not.toBeNull();
    expect(authUtils.isEmailAllowed).toHaveBeenCalledWith({
      email: mixedCaseEmail,
    });
  });

  it('GUARDRAIL: should reject passwords shorter than 8 characters on the backend', async () => {
    vi.mocked(authUtils.isEmailAllowed).mockResolvedValue(true);

    const result = await authorize({
      email: 'test@example.com',
      password: 'short', // 5 chars
      action: 'register',
    });

    expect(result).toBeNull();
  });

  it('GUARDRAIL: should migrate legacy users without passwords correctly', async () => {
    const email = 'legacy@example.com';
    const password = 'new-password-123';

    // Mock a user that exists but has no password (e.g. legacy account migration)
    vi.mocked(authUtils.isEmailAllowed).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'legacy-id',
      email,
      password: null,
    } as any);

    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'legacy-id',
      email,
      password: 'hashed-password',
    } as any);

    const result = await authorize({
      email,
      password,
      action: 'login',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'legacy-id' },
        data: expect.objectContaining({
          password: expect.any(String),
        }),
      }),
    );
    expect(result).not.toBeNull();
  });
});
