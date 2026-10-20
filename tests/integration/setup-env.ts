import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
 
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("SAFETY ABORT: TEST_DATABASE_URL is required to run integration tests.");
}
if (process.env.DATABASE_URL && process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error("SAFETY ABORT: TEST_DATABASE_URL cannot be identical to DATABASE_URL.");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
