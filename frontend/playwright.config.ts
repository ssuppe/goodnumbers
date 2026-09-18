import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60 * 1000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "on",
    video: "on",
  },
  projects: [
    {
      name: "Mobile Pixel",
      use: {
        ...devices["Pixel 7"],
      },
    },
    {
      name: "Mobile iPhone",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
