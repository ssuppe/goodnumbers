import { vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables without overriding already defined variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

vi.mock('ioredis', async () => {
  const { EventEmitter } = await import('events');
  class IORedisMock extends EventEmitter {
    constructor() {
      super();
      process.nextTick(() => this.emit('connect'));
    }
    disconnect = vi.fn();
  }
  return { Redis: IORedisMock, default: IORedisMock };
});
