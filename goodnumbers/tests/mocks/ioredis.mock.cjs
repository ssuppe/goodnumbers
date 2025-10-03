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

// CRITICAL FIX: This structure handles different module import syntaxes.
// It makes the class available as the main export AND as the default export.
module.exports = IORedisMock;
module.exports.default = IORedisMock;