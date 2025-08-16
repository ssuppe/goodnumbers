module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?': ['ts-jest', { useESM: true, tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js': '$1',
    '\\.(json)$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
