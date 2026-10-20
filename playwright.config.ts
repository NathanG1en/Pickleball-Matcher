import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const testDbUrl = process.env.TEST_DATABASE_URL;

if (!testDbUrl) {
  throw new Error(
    "SAFETY ABORT: TEST_DATABASE_URL must be defined to run E2E tests. Refusing to run tests against production or fallback database."
  );
}

const originalDatabaseUrl = process.env.ORIGINAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!process.env.ORIGINAL_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
}

if (originalDatabaseUrl && testDbUrl === originalDatabaseUrl) {
  throw new Error(
    "SAFETY ABORT: TEST_DATABASE_URL cannot be identical to DATABASE_URL. Use a separate test database branch."
  );
}

// Force DATABASE_URL in process.env so any imported modules in the test runner also use TEST_DATABASE_URL
process.env.DATABASE_URL = testDbUrl;

const testPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? `http://localhost:${testPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
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
    command: process.env.CI
      ? `npx next start -p ${testPort}`
      : `npx next dev -p ${testPort}`,
    url: `http://localhost:${testPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: testPort,
      DATABASE_URL: testDbUrl,
      TEST_DATABASE_URL: testDbUrl,
      ORGANIZER_SESSION_SECRET: process.env.ORGANIZER_SESSION_SECRET ?? "test-organizer-session-secret-at-least-32-chars",
      ORGANIZER_FINGERPRINT_SECRET: process.env.ORGANIZER_FINGERPRINT_SECRET ?? "test-fingerprint-secret-at-least-32-chars",
      SESSION_COOKIE_SECURE: "false",
      SETUP_TOKEN: process.env.SETUP_TOKEN ?? "test-setup-token",
    },
  },
});
