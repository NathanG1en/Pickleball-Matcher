import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
 
const getDatabaseIdentity = (value?: string) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
};

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("SAFETY ABORT: TEST_DATABASE_URL is required to run integration tests.");
}

const appDb = getDatabaseIdentity(process.env.DATABASE_URL);
const testDb = getDatabaseIdentity(process.env.TEST_DATABASE_URL);

if (appDb && testDb && appDb === testDb) {
  throw new Error("SAFETY ABORT: TEST_DATABASE_URL cannot point to the same database as DATABASE_URL.");
}

process.env.APP_DATABASE_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

