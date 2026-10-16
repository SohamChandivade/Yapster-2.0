import { defineConfig } from "@playwright/test";

/** Mobile-only: every critical flow runs at iPhone 14 size (390×844). */
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  // The dev server compiles each page on first visit; give navigations room for that.
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
