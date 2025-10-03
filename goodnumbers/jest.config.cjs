module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    /**
     * This rule globally mocks 'ioredis' using our CommonJS mock file.
     * This is CRITICAL to prevent connection errors in the test environment.
     */
    '^ioredis$': '<rootDir>/tests/mocks/ioredis.mock.cjs',

    /**
     * This rule is CRITICAL for resolving local module imports.
     * It tells Jest how to find the .ts source file when an import uses a .js extension.
     * This was the line I mistakenly removed.
     */
    '^(\\.{1,2}/.*)\\.js$': '$1',

    '\\.(json)$': '<rootDir>/__mocks__/fileMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
