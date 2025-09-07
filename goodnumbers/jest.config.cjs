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
    // REMOVED: The problematic line '^(.+)\\.js$': '$1' is gone.
    // ts-jest with useESM can now handle this resolution automatically
    // without interfering with node_modules packages.

    // This line remains correct for mocking file assets.
    '\\.(json)$': '<rootDir>/__mocks__/fileMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
