# Engineering Plan: Phase 1, Task 1 - Project Initialization

**Objective:** Establish the foundational structure of the Node.js project, including dependency installation, TypeScript configuration, and linting setup.

## 1. Create Project Directory

Create the main directory for the project.

```bash
mkdir /home/ssuppe/vscode/goodnumbers-workspace/goodnumbers
# Note: All subsequent commands in this document should be run from within the 'goodnumbers' directory.
# If you are running these commands from the project root, prepend 'cd goodnumbers && ' to each command.
```

## 2. Initialize Node.js Project

Initialize a new Node.js project with a default `package.json` file.

```bash
npm init -y
```

**Important:** After initialization, open `package.json` and add "type": "module" to enable ES module support. This is crucial for modern Node.js development and compatibility with tools like ESLint's flat config.

```json
{
  "name": "goodnumbers",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module"  // Add this line
}
```

## 3. Install Dependencies

### 3.1. Production Dependencies

Install the core libraries required for the application to run.

```bash
npm install express prisma dotenv
```

- **express:** Web server framework.
- **prisma:** ORM for database access.
- **dotenv:** For managing environment variables.

### 3.2. Development Dependencies

Install the tools and libraries needed for development, testing, and building.

```bash
npm install -D typescript @types/node @types/express ts-node nodemon prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin jest @types/jest ts-jest supertest @types/supertest typescript-eslint @eslint/js globals
```

- **typescript:** The TypeScript compiler.
- **@types/node, @types/express:** Type definitions for Node.js and Express.
- **ts-node:** To run TypeScript code directly without pre-compilation.
- **nodemon:** To automatically restart the server on file changes during development.
- **prettier:** For code formatting.
- **eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, typescript-eslint, @eslint/js, globals:** For robust code linting with TypeScript support using ESLint's new flat configuration.
- **jest, @types/jest, ts-jest:** For running unit and integration tests with TypeScript.
- **supertest, @types/supertest:** For testing HTTP assertions against the Express server.

## 4. Configure TypeScript

Create a `tsconfig.json` file in the project root with the following content. This file configures the TypeScript compiler for ES module output and proper module resolution.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020", // Changed from "commonjs" for ES module compatibility
    "moduleResolution": "node", // Added for proper module resolution in Node.js environment
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```
*Note: We remove `**/*.spec.ts` from the `exclude` array as `ts-jest` will handle the test files.*

## 5. Configure Prettier

Create a `.prettierrc` file in the project root to enforce a consistent code style.

```json
{
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true
}
```

## 6. Configure ESLint

Delete any existing `.eslintrc.*` files. Create an `eslint.config.js` file in the project root to configure ESLint for TypeScript using the new flat configuration format. This configuration also ignores the `dist` directory to prevent linting compiled JavaScript files.

```javascript
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    // Files to lint and global variables
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: { globals: globals.node }, // Use globals.node for Node.js environment
  },
  // Recommended ESLint rules
  pluginJs.configs.recommended,
  // Recommended TypeScript ESLint rules
  ...tseslint.configs.recommended,
  {
    // Custom rules or overrides
    rules: {
      // Add any specific rules here
    },
  },
  {
    // Ignore compiled output directory
    ignores: ["dist/**"],
  },
];
```

## 7. Configure Jest

Rename `jest.config.js` to `jest.config.cjs` to ensure it's treated as a CommonJS module, compatible with the ES module setup of the project.

Create a `jest.config.cjs` file in the project root. This configures Jest to work with TypeScript via `ts-jest`.

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)']
};
```

## 8. Create `.gitignore`

Create a `.gitignore` file in the project root to prevent generated files and sensitive information from being committed to version control.

```
# Dependencies
/node_modules

# Build output
/dist

# Environment variables
.env

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Jest cache
/coverage
.jest-cache
```

## 9. Create Initial Application Structure

Create the `src` directory and a basic Express server file.

Create the `src` directory:
```bash
mkdir src
```

Create a file at `src/index.ts` with the following content:

```typescript
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

// Note: We are exporting the app for testing purposes
export const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// This check ensures the server doesn't start during tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
```

## 10. Configure `nodemon` for Development

Create a `nodemon.json` file in the project root to configure `nodemon` to work with `ts-node`.

```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "ts-node ./src/index.ts"
}
```

## 11. Add Scripts to `package.json`

Add the following scripts to your `package.json` file to streamline development and build processes.

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "nodemon",
  "build": "tsc",
  "test": "jest",
  "lint": "eslint . --ext .ts",
  "prettier": "prettier --write ."
}
```

## 12. Verification

Run the following commands to verify that the project is set up correctly.

1.  **Format code with Prettier:**
    ```bash
    npm run prettier
    ```

2.  **Lint the code with ESLint:**
    ```bash
    npm run lint
    ```

3.  **Run the tests with Jest:**
    ```bash
    npm run test
    ```
    This should execute the test runner. It will exit with code 1 if no test files are found, which is expected at this stage.

4.  **Build the project with TypeScript:**
    ```bash
    npm run build
    ```
    This should create a `dist` directory with the compiled JavaScript code.

5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    You should see "Server is running on port 3000" in the console. This process will run in the foreground.

6.  **Run the production server:**
    ```bash
    npm run start
    ```
    You should see "Server is running on port 3000" in the console.