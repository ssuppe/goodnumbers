// file: backend/vitest.setup.ts
import 'dotenv/config';
import { vi } from 'vitest';

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
