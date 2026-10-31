// Start an explicitly instrumented local dev server against the test branch.
// npx tsx scripts/benchmarks/action-revalidation-server.mjs TRACE_FILE [PORT]
import nextEnv from "@next/env";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^ep-cold-band-b491lrgj(?:-pooler)?\./.test(new URL(url).hostname)) throw new Error("Expected allowlisted Neon test branch");
const [trace, port = "3117"] = process.argv.slice(2);
if (!trace || !/^\d+$/.test(port)) throw new Error("Supply trace file and optional numeric port");
const tracePath = resolve(trace);
mkdirSync(dirname(tracePath), { recursive: true });
const preload = fileURLToPath(new URL("./action-revalidation-preload.cjs", import.meta.url));
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: url, SESSION_REVALIDATION_TRACE: tracePath,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(preload)}`,
    NEXT_DIST_DIR: ".next-test/action-revalidation", SESSION_COOKIE_SECURE: "false",
    ORGANIZER_SESSION_SECRET: process.env.ORGANIZER_SESSION_SECRET ?? "test-organizer-session-secret-at-least-32-chars",
    ORGANIZER_FINGERPRINT_SECRET: process.env.ORGANIZER_FINGERPRINT_SECRET ?? "test-fingerprint-secret-at-least-32-chars" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
