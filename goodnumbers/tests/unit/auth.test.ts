import { describe, it, expect, jest } from "@jest/globals";

describe("Auth Configuration Properties", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv; // Restore original environment
    jest.resetModules(); // Important to clear module cache
  });

  it("should set trustHost to TRUE only in a production environment", async () => {
    // Test case 1: Production
    process.env.NODE_ENV = "production";
    const { authConfig: prodConfig } = await import("../../src/lib/auth.js");
    expect(prodConfig.trustHost).toBe(true);
  });

  it("should set trustHost to TRUE in a test environment", async () => { // NEW TEST CASE
    process.env.NODE_ENV = "test";
    const { authConfig: testConfig } = await import("../../src/lib/auth.js");
    expect(testConfig.trustHost).toBe(true);
  });

  it("should set trustHost to FALSE in a development environment", async () => {
    // Test case 2: Development
    process.env.NODE_ENV = "development";
    const { authConfig: devConfig } = await import("../../src/lib/auth.js");
    expect(devConfig.trustHost).toBe(false);
  });

  it("should set trustHost to FALSE when NODE_ENV is not set", async () => {
    // Test case 3: Unset (defaults to safe)
    delete process.env.NODE_ENV;
    const { authConfig: defaultConfig } = await import("../../src/lib/auth.js");
    expect(defaultConfig.trustHost).toBe(false);
  });
});
