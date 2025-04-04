/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testTimeout: 10000, // Increase timeout if needed

  testEnvironment: 'node',
  // Tells Jest where to find test files
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  // Optional: if you use path aliases in tsconfig
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/src/$1',
    '^app/(.*)$': '<rootDir>/app/$1',

  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  },
};

module.exports = config;