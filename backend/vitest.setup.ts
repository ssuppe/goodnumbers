import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { afterAll } from 'vitest';

// Generate a unique database file for the entire test run.
const dbFile = `test-${crypto.randomUUID()}.db`;
const dbPath = path.join(__dirname, dbFile);
process.env.DATABASE_URL = `file:${dbFile}`;

// Apply migrations to the test database before any tests run.
execSync('npx prisma migrate deploy');

// Schedule cleanup of the database file after all tests have run.
afterAll(() => {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});
import "dotenv/config";

// NOTE: We do not import `vi` here. Vitest makes it globally available in the setup file.
// Importing it can cause circular dependency errors.
vi.mock("ioredis", async () => {
  // Use a dynamic import() to load the module lazily and satisfy the linter.
  const { EventEmitter } = await import("events");
  class IORedisMock extends EventEmitter {
    constructor() {
      super();
      // Emit 'connect' on the next tick to simulate async connection
      process.nextTick(() => this.emit("connect"));
    }
    // Mock the disconnect function
    disconnect = vi.fn();
  }
  return { Redis: IORedisMock, default: IORedisMock };
});