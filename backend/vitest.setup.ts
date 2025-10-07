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