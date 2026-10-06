import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next dev -p 3000 -H 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      ORGANIZER_SESSION_SECRET: process.env.ORGANIZER_SESSION_SECRET ?? "test-organizer-session-secret-at-least-32-chars",
      ORGANIZER_FINGERPRINT_SECRET: process.env.ORGANIZER_FINGERPRINT_SECRET ?? "test-fingerprint-secret-at-least-32-chars",
      SESSION_COOKIE_SECURE: "false",
      SETUP_TOKEN: process.env.SETUP_TOKEN ?? "test-setup-token",
    },
  },
});
