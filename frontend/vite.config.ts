import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"; // Import the plugin
import path from "path"; // Import path module

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add the plugin
  ],
  resolve: {
    // Add resolve configuration
    alias: {
      "@goodnumbers/types": path.resolve(
        __dirname,
        "../packages/types/src/index.ts",
      ),
      "@goodnumbers/schemas": path.resolve(
        __dirname,
        "../packages/schemas/src/index.ts",
      ),
      "@goodnumbers/common": path.resolve(
        __dirname,
        "../packages/common/src/index.ts",
      ),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["192.168.1.3.nip.io"],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
