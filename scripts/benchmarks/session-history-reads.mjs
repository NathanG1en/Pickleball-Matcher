// npx tsx scripts/benchmarks/session-history-reads.mjs SESSION_ID BASELINE_CHECKOUT [RESULT_FILE]
// Read-only: compares both repository implementations against one completed
// session on the allowlisted test branch, with full returned-record equality.
import nextEnv from "@next/env";
import postgres from "postgres";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^ep-cold-band-b491lrgj(?:-pooler)?\./.test(new URL(url).hostname)) throw new Error("Expected allowlisted Neon test branch");
const [sessionId, baselinePath, resultPath = "docs/benchmarks/data/session-history-reads.json"] = process.argv.slice(2);
if (!sessionId || !baselinePath) throw new Error("Supply a stable completed test session ID and baseline checkout");
const { PostgresRepositories: BaselineRepository } = await import(pathToFileURL(resolve(baselinePath, "src/lib/db/postgres-repositories.ts")).href);
let capture = false;
let queries = 0;
const sql = postgres(url, { max: 10, prepare: false, idle_timeout: 20, connect_timeout: 15, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const baseline = new BaselineRepository(sql);
const optimized = new PostgresRepositories(sql);
const samples = [];
try {
  const session = await optimized.getSession(sessionId);
  assert.equal(session?.status, "completed", "Use a completed fixture to keep history stable during comparison");
  await Promise.all(Array.from({ length: 10 }, () => sql`select 1`));
  const expected = await baseline.listStartedRounds(sessionId);
  assert.ok(expected.length > 0 && expected.some(round => round.matches.length > 0), "Fixture needs rounds and matches");
  assert.deepEqual(await optimized.listStartedRounds(sessionId), expected);
  for (let iteration = 0; iteration < 7; iteration++) {
    for (const variant of iteration % 2 ? ["optimized", "baseline"] : ["baseline", "optimized"]) {
      queries = 0; capture = true;
      const start = performance.now();
      const actual = await (variant === "baseline" ? baseline : optimized).listStartedRounds(sessionId);
      const ms = performance.now() - start;
      capture = false;
      assert.deepEqual(actual, expected);
      assert.equal(queries, 4);
      const sample = { variant, iteration, ms, queries };
      samples.push(sample);
      console.log(JSON.stringify(sample));
    }
  }
  const summary = Object.fromEntries(["baseline", "optimized"].map(variant => {
    const times = samples.filter(sample => sample.variant === variant).map(sample => sample.ms).sort((a, b) => a - b);
    return [variant, { n: times.length, medianMs: times[3], minMs: times[0], maxMs: times.at(-1) }];
  }));
  const output = { sessionId, baselineCheckout: resolve(baselinePath), poolSize: 10, database: "Neon test branch; SELECTs only", rounds: expected.length,
    matches: expected.reduce((sum, round) => sum + round.matches.length, 0), samples, summary };
  const target = resolve(resultPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally { await sql.end(); }
