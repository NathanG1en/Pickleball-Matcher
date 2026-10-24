import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("SAFETY ABORT: TEST_DATABASE_URL is required to run integration tests.");
}

const originalDatabaseUrl = process.env.ORIGINAL_DATABASE_URL !== undefined
  ? (process.env.ORIGINAL_DATABASE_URL || undefined)
  : process.env.DATABASE_URL;

if (process.env.ORIGINAL_DATABASE_URL === undefined) {
  process.env.ORIGINAL_DATABASE_URL = process.env.DATABASE_URL ?? "";
}

if (originalDatabaseUrl && process.env.TEST_DATABASE_URL === originalDatabaseUrl) {
  throw new Error("SAFETY ABORT: TEST_DATABASE_URL cannot be identical to DATABASE_URL.");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
