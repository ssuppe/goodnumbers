import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const OLD_ENV = { ...process.env };

// Mock env.js to prevent it from loading .env files during tests
// We mock both the alias and the relative path to be safe
vi.mock('@src/lib/env.js', () => ({}));
vi.mock('../../src/lib/env.js', () => ({}));

// Mock @auth/express to bypass its internal validation
vi.mock('@auth/express', () => ({
  ExpressAuth: vi.fn(() => (req: Request, res: Response, next: NextFunction) => next()), // Mock ExpressAuth to return a dummy middleware
  getSession: vi.fn(), // Mock getSession as well if it's used
}));

describe('Application Startup', () => {
  beforeEach(() => {
    vi.resetModules(); // Reset modules to ensure fresh import of createApp and env.ts
    
    // Reset environment variables using vi.stubEnv
    for (const key in process.env) {
      vi.stubEnv(key, OLD_ENV[key] || '');
    }
    
    // Set all other critical env vars to valid values to isolate the test
    vi.stubEnv('AUTH_SECRET', 'YOUR_32_CHAR_AUTH_SECRET_HERE_1234'); // 32 chars
    vi.stubEnv('AUTH_GOOGLE_ID', 'test_google_id');
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'test_google_secret');
    vi.stubEnv('CSRF_SECRET', 'test_csrf_secret_123456789012345678901234567890');
    vi.stubEnv('COOKIE_SECRET', 'test_cookie_secret_123456789012345678901234567890');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should throw a fatal error if AUTH_SECRET is not set', async () => {
    vi.stubEnv('AUTH_SECRET', '');
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow('FATAL: Environment variable AUTH_SECRET is not set.');
  });

  it('should throw a fatal error if AUTH_GOOGLE_ID is not set', async () => {
    vi.stubEnv('AUTH_GOOGLE_ID', '');
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow('FATAL: Environment variable AUTH_GOOGLE_ID is not set.');
  });

  it('should throw a fatal error if AUTH_GOOGLE_SECRET is not set', async () => {
    vi.stubEnv('AUTH_GOOGLE_SECRET', '');
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow('FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.');
  });
});