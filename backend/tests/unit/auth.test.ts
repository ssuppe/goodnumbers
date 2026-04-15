import { describe, it, expect, afterEach, vi } from 'vitest';

describe('Auth Configuration Properties', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules(); // Use Vitest's resetModules
  });

  it('should set trustHost to TRUE in a production environment', async () => {
    process.env.NODE_ENV = 'production';
    const { authConfig: prodConfig } = await import('@src/lib/auth.ts');
    expect(prodConfig.trustHost).toBe(true);
  });

  it('should set trustHost to TRUE in a test environment', async () => {
    process.env.NODE_ENV = 'test';
    const { authConfig: testConfig } = await import('@src/lib/auth.ts');
    expect(testConfig.trustHost).toBe(true);
  });

  it('should set trustHost to TRUE in a development environment', async () => {
    process.env.NODE_ENV = 'development';
    const { authConfig: devConfig } = await import('@src/lib/auth.ts');
    expect(devConfig.trustHost).toBe(true);
  });

  it('should set trustHost to TRUE when NODE_ENV is not set', async () => {
    delete process.env.NODE_ENV;
    const { authConfig: defaultConfig } = await import('@src/lib/auth.ts');
    expect(defaultConfig.trustHost).toBe(true);
  });
});