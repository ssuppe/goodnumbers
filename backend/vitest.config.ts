// file: backend/vitest.config.ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import dotenv from 'dotenv';

export default defineConfig({
  test: {
    threads: false,
    environment: 'node',
    env: {
      // Load environment variables from the monorepo root
      ...dotenv.config({ path: path.resolve(__dirname, '../.env.test') })
        .parsed,
    },
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./vitest.global-setup.ts'], // <-- ADD THIS LINE
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@goodnumbers/schemas': path.resolve(
        __dirname,
        '../packages/schemas/src/index.ts',
      ),
      '@goodnumbers/types': path.resolve(
        __dirname,
        '../packages/types/src/index.ts',
      ),
    },
  },
});
