// npx tsx scripts/benchmarks/batch-score-saving.mjs [source checkout] [result file]
// Test-branch-only benchmark. All fixture mutations shadow public tables on one
// connection; closing it discards every temporary table and benchmark row.
import nextEnv from "@next/env";
import postgres from "postgres";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { seedBatchScores, batchNow } from "../../tests/fixtures/batch-scores.ts";

nextEnv.loadEnvConfig(process.cwd());
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !/^ep-cold-band-b491lrgj(?:-pooler)?\./.test(new URL(connectionString).hostname)) {
  throw new Error("Benchmark requires the allowlisted Neon test branch");
}
const source = resolve(process.argv[2] ?? process.cwd());
const output = resolve(process.argv[3] ?? "docs/benchmarks/data/bulk-score-saving-optimized.json");
const { PostgresRepositories } = await import(pathToFileURL(resolve(source, "src/lib/db/postgres-repositories.ts")).href);
const { SessionService } = await import(pathToFileURL(resolve(source, "src/lib/domain/session-service.ts")).href);
let capture = false;
let queries = 0;
const sql = postgres(connectionString, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const samples = [];
try {
  for (const table of ["groups", "player_accounts", "players", "group_organizers", "sessions", "session_attendance", "rounds", "matches", "match_players", "round_sits", "player_synergy"]) {
    await sql.unsafe(`create temporary table ${table} (like public.${table} including all)`);
  }
  const [isolation] = await sql`select c.relnamespace = pg_my_temp_schema() as isolated from pg_class c where c.oid = 'matches'::regclass`;
  assert.equal(isolation?.isolated, true, "Refusing fixture writes without temporary table isolation");
  const repository = new PostgresRepositories(sql);
  const service = new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });
  const { inputs } = await seedBatchScores(repository, 4);
  for (let iteration = -1; iteration < 5; iteration++) {
    // Reset only this connection's temporary fixture, outside the timed region.
    await sql`update matches set status='pending', team1_score=null, team2_score=null, completed_at=null, version=1`;
    queries = 0;
    capture = true;
    const start = performance.now();
    const result = await service.recordMultipleResults(inputs);
    const ms = performance.now() - start;
    capture = false;
    assert.equal(result.length, 4);
    assert.ok(result.every(match => match.version === 2 && match.status === "completed"));
    assert.equal((await repository.getPlayerAccount("batch-account-0")).rating, 1020);
    assert.equal((await repository.getPlayerAccount("batch-account-2")).rating, 980);
    if (iteration >= 0) {
      samples.push({ iteration, ms, queries });
      console.log(JSON.stringify(samples.at(-1)));
    }
  }
  const sorted = samples.map(sample => sample.ms).sort((a, b) => a - b);
  const result = { source, database: "Neon test branch; temporary tables only", courts: 4, players: 16, warmupSamples: 1,
    samples, medianMs: sorted[2], minMs: sorted[0], maxMs: sorted.at(-1) };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
} finally { await sql.end(); }
