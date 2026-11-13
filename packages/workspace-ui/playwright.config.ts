import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
        viewport: { width: 1440, height: 960 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
