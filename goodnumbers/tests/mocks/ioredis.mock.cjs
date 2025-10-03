// file: tests/mocks/ioredis.mock.cjs
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
'use strict';
const EventEmitter = require('events');

class IORedisMock extends EventEmitter {
  constructor(options = {}) {
    super();
    process.nextTick(() => this.emit('connect'));
  }
  disconnect = jest.fn();
}

/**
 * CRITICAL FIX: We now export an object that has a `Redis` property.
 * This perfectly matches the `import { Redis } from 'ioredis'` syntax
 * used in the application code.
 *
 * We also keep the `default` export for full compatibility.
 */
module.exports = {
  Redis: IORedisMock,
  default: IORedisMock,
};
