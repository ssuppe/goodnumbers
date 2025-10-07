import "dotenv/config";
import { vi } from "vitest";

import { EventEmitter } from "events";

vi.mock("ioredis", () => {
  class IORedisMock extends EventEmitter {
    constructor() {
      super();
      process.nextTick(() => this.emit("connect"));
    }
    disconnect = vi.fn();
  }
  return { Redis: IORedisMock, default: IORedisMock };
});