// file: goodnumbers/tests/unit/auth.allowlist.test.ts
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock the fs/promises module BEFORE importing the auth module that uses it.
// This is critical for ES Modules.
jest.unstable_mockModule("fs/promises", () => ({
  readFile: jest.fn(),
}));

// Now, dynamically import the modules after the mock has been configured.
const { readFile } = await import("fs/promises");

// Type assertion for the mocked function
const mockedReadFile = readFile as jest.Mock;

describe("Auth.js signIn Callback", () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    mockedReadFile.mockClear();
    // CRITICAL: Reset the module cache to clear the internal in-memory cache
    // within auth.ts, ensuring tests are independent and not flaky.
    jest.resetModules();
  });

  it("should return TRUE for a user whose email is on the allowlist", async () => {
    // Arrange: Simulate a valid allowlist file
    const allowlistContent = "user1@example.com\nuser2@example.com";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user1@example.com" },
    } as any);

    // Assert
    expect(result).toBe(true);
  });

  it("should return FALSE for a user whose email is NOT on the allowlist", async () => {
    // Arrange
    const allowlistContent = "user1@example.com\nuser2@example.com";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "3", email: "user3@example.com" },
    } as any);

    // Assert
    expect(result).toBe(false);
  });

  it("should handle case-insensitivity correctly", async () => {
    // Arrange
    const allowlistContent = "User.One@Example.COM";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user.one@example.com" },
    } as any);

    // Assert
    expect(result).toBe(true);
  });

  it("should ignore comments and empty lines in the allowlist file", async () => {
    // Arrange
    const allowlistContent = `
      # This is a comment
      user1@example.com

      user2@example.com
    `;
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const allowed = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user1@example.com" },
    } as any);
    const denied = await authConfig.callbacks!.signIn!({
      user: { id: "3", email: "# This is a comment" },
    } as any);

    // Assert
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });

  it("should return FALSE if the allowlist file cannot be read (secure default)", async () => {
    // Arrange: Simulate a file system error
    mockedReadFile.mockRejectedValue(new Error("File not found"));
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: "user1@example.com" },
    } as any);

    // Assert
    expect(result).toBe(false);
  });

  it("should return FALSE if the user has no email", async () => {
    // Arrange
    const allowlistContent = "user1@example.com";
    mockedReadFile.mockResolvedValue(allowlistContent);
    const { authConfig } = await import("../../src/lib/auth.js");

    // Act
    const result = await authConfig.callbacks!.signIn!({
      user: { id: "1", email: null },
    } as any);

    // Assert
    expect(result).toBe(false);
  });
});