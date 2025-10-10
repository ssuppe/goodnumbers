/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "src"),
      "@goodnumbers/schemas": path.resolve(
        __dirname,
        "../packages/schemas/src/index.ts"
      ),
      "@goodnumbers/types": path.resolve(
        __dirname,
        "../packages/types/src/index.ts"
      ),
    },
  },
});