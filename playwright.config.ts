import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000",
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
    command: process.env.CI ? "npx next start -p 3000" : "npm run dev",
    url: "http://localhost:3000",
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
