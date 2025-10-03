// goodnumbers/jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    // This maps .js imports to .ts files for local relative imports in ESM.                                                            │
    // It's crucial for Jest to find the source files when imports use .js extensions.                                                  │
    '^(\\.{1,2}/.*)\\.js$': '$1',

    // This line remains correct for mocking file assets.
    '\\.(json)$': '<rootDir>/__mocks__/fileMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
