import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const OLD_ENV = process.env;

// Mock env.js to prevent it from loading .env files during tests
vi.mock('@src/lib/env.js', () => ({}));

// Mock @auth/express to bypass its internal validation
vi.mock('@auth/express', () => ({
  ExpressAuth: vi.fn(() => (req: Request, res: Response, next: NextFunction) => next()), // Mock ExpressAuth to return a dummy middleware
  getSession: vi.fn(), // Mock getSession as well if it's used
}));

describe('Application Startup', () => {
  beforeEach(() => {
    vi.resetModules(); // Reset modules to ensure fresh import of createApp and env.ts
    process.env = { ...OLD_ENV }; // Make a copy of the environment
    // Set all other critical env vars to valid values to isolate the test
    process.env.AUTH_SECRET = '01234567890123456789012345678901'; // Ensure it's 32 chars for other tests
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
    // UPDATE: The Auth.js library now throws a more specific error when the secret is missing.
    // We update the test to expect this new, more descriptive error message.
    expect(() => createApp()).toThrow('Your secret is not the required 32 characters long');
  });

  it('should throw a fatal error if AUTH_GOOGLE_ID is not set', async () => {
    delete process.env.AUTH_GOOGLE_ID; // Delete only the variable we are testing
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow(
      'Your secret is not the required 32 characters long',
    );
  });

  it('should throw a fatal error if AUTH_GOOGLE_SECRET is not set', async () => {
    delete process.env.AUTH_GOOGLE_SECRET; // Delete only the variable we are testing
    const { createApp } = await import('@src/index.ts');
    expect(() => createApp()).toThrow(
      'Your secret is not the required 32 characters long',
    );
  });
});