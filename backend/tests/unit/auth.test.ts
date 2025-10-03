import { describe, it, expect, jest } from '@jest/globals';

describe('Auth Configuration Properties', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv; // Restore original environment
    jest.resetModules(); // Important to clear module cache
  });

  it('should set trustHost to TRUE in a production environment', async () => {
    // Test case 1: Production
    process.env.NODE_ENV = 'production';
    const { authConfig: prodConfig } = await import('../../src/lib/auth.ts');
    expect(prodConfig.trustHost).toBe(true);
  });

  it('should set trustHost to TRUE in a test environment', async () => {
    // Test case 2: Test (for supertest compatibility)
    process.env.NODE_ENV = 'test';
    const { authConfig: testConfig } = await import('../../src/lib/auth.ts');
    expect(testConfig.trustHost).toBe(true);
  });

  it('should set trustHost to TRUE in a development environment', async () => {
    // Test case 3: Development
    process.env.NODE_ENV = 'development';
    const { authConfig: devConfig } = await import('../../src/lib/auth.ts');
    expect(devConfig.trustHost).toBe(true);
  });

  it('should set trustHost to TRUE when NODE_ENV is not set', async () => {
    // Test case 4: Unset (defaults to safe)
    delete process.env.NODE_ENV;
    const { authConfig: defaultConfig } = await import('../../src/lib/auth.ts');
    expect(defaultConfig.trustHost).toBe(true);
  });
});
