/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Tells Jest where to find test files
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  // Optional: if you use path aliases in tsconfig
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
};

module.exports = config;