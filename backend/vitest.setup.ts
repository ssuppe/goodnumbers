import "dotenv/config";
import { vi } from "vitest";

vi.mock("ioredis", () => {
  const EventEmitter = require("events");
  class IORedisMock extends EventEmitter {
    constructor() {
      super();
      process.nextTick(() => this.emit("connect"));
    }
    disconnect = vi.fn();
  }
  return { Redis: IORedisMock, default: IORedisMock };
});