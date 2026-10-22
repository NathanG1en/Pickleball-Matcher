import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import postgres from "postgres";

// Only this runner creates/drops a database, and only on an explicitly supplied
// loopback test server. It never loads .env files or application DATABASE_URL.
const value = process.env.MAINTENANCE_TEST_ADMIN_URL;
if (!value) throw new Error("MAINTENANCE_TEST_ADMIN_URL must point to a disposable local Postgres server.");
const url = new URL(value);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || [...url.searchParams.keys()].some(key => !["sslmode"].includes(key))) {
  throw new Error("Maintenance integration tests require a loopback Postgres server without routing overrides.");
}
const name = `rating_maintenance_test_${randomUUID().replaceAll("-", "")}`;
const admin = postgres(value, { max: 1, onnotice: () => {} });
let created = false;
try {
  await admin.unsafe(`create database ${name}`);
  created = true;
  url.pathname = `/${name}`;
  const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.maintenance.config.ts"], {
    stdio: "inherit", env: { ...process.env, MAINTENANCE_INTEGRATION_DATABASE_URL: url.toString() },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
} catch {
  console.error("Maintenance integration runner failed; check the disposable local test server.");
  process.exitCode = 1;
} finally {
  if (created) await admin.unsafe(`drop database ${name} with (force)`);
  await admin.end();
}
