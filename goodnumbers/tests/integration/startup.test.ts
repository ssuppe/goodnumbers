import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import { createApp } from '../../src/index.ts';

describe('Application Startup', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('should throw a fatal error if AUTH_SECRET is not set', () => {
    delete process.env.AUTH_SECRET;
    expect(() => createApp()).toThrow(
      'FATAL: Environment variable AUTH_SECRET is not set.',
    );
  });

  it('should throw a fatal error if AUTH_GOOGLE_ID is not set', () => {
    delete process.env.AUTH_GOOGLE_ID;
    expect(() => createApp()).toThrow(
      'FATAL: Environment variable AUTH_GOOGLE_ID is not set.',
    );
  });

  it('should throw a fatal error if AUTH_GOOGLE_SECRET is not set', () => {
    delete process.env.AUTH_GOOGLE_SECRET;
    expect(() => createApp()).toThrow(
      'FATAL: Environment variable AUTH_GOOGLE_SECRET is not set.',
    );
  });
});
