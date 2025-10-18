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
      "@goodnumbers/types": path.resolve(__dirname, "../packages/types/src"), // Alias for @goodnumbers/types
      "@goodnumbers/common": path.resolve(__dirname, "../packages/common/src"), // Alias for @goodnumbers/common
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
