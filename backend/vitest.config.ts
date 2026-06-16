// file: backend/vitest.config.ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    threads: false,
    environment: 'node',
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
      '@goodnumbers/common': path.resolve(
        __dirname,
        '../packages/common/src/index.ts',
      ),
    },
  },
});
