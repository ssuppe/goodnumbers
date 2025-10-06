import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const OLD_ENV = process.env;

// Mock env.js to prevent it from loading .env files during tests
vi.mock('@src/lib/env.js', () => ({}));

// Mock @auth/express to bypass its internal validation
vi.mock('@auth/express', () => ({
  ExpressAuth: vi.fn(() => (req: any, res: any, next: any) => next()), // Mock ExpressAuth to return a dummy middleware
  getSession: vi.fn(), // Mock getSession as well if it's used
}));

describe('Application Startup', () => {
  beforeEach(() => {
    vi.resetModules(); // Reset modules to ensure fresh import of createApp and env.ts
    process.env = { ...OLD_ENV }; // Make a copy of the environment
    // Set all other critical env vars to valid values to isolate the test
    process.env.AUTH_SECRET = 'YOUR_32_CHAR_AUTH_SECRET_HERE'; // Ensure it's 32 chars for other tests
    process.env.AUTH_GOOGLE_ID = 'test_google_id';
    process.env.AUTH_GOOGLE_SECRET = 'test_google_secret';
    process.env.CSRF_SECRET = 'test_csrf_secret_123456789012345678901234567890';
    process.env.COOKIE_SECRET = 'test_cookie_secret_123456789012345678901234567890';
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore original env
  });

  it('should throw a fatal error if AUTH_SECRET is not set', async () => {
    delete process.env.AUTH_SECRET; // Delete only the variable we are testing
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow(
      'FATAL: Environment variable AUTH_SECRET is not set.',
    );
  });

  it('should throw a fatal error if AUTH_GOOGLE_ID is not set', async () => {
    delete process.env.AUTH_GOOGLE_ID; // Delete only the variable we are testing
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow(
      'FATAL: Environment variable AUTH_GOOGLE_ID is not set.',
    );
  });

  it('should throw a fatal error if AUTH_GOOGLE_SECRET is not set', async () => {
    delete process.env.AUTH_GOOGLE_SECRET; // Delete only the variable we are testing
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow(
      'FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.',
    );
  });
});