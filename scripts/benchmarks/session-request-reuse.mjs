// npx tsx scripts/benchmarks/session-request-reuse.mjs SESSION_ID [RESULT_FILE]
// SELECT-only comparison of duplicate proposal reads versus request snapshot reuse.
import nextEnv from "@next/env";
import postgres from "postgres";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories.ts";
import { SessionService } from "../../src/lib/domain/session-service.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^ep-cold-band-b491lrgj(?:-pooler)?\./.test(new URL(url).hostname)) throw new Error("Expected allowlisted Neon test branch");
const [sessionId, resultPath = "docs/benchmarks/data/session-request-reuse.json"] = process.argv.slice(2);
if (!sessionId) throw new Error("Supply a stable completed test session ID");
let capture = false;
let queries = 0;
const sql = postgres(url, { max: 10, prepare: false, idle_timeout: 20, connect_timeout: 15, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const repository = new PostgresRepositories(sql);
const service = new SessionService(repository, { now: () => new Date(), nextId: kind => kind, nextSeed: () => 42 });
const samples = [];
try {
  const session = await repository.getSession(sessionId);
  assert.equal(session?.status, "completed", "Completed history must stay stable during comparison");
  await Promise.all(Array.from({ length: 10 }, () => sql`select 1`));
  const loadInputs = async () => {
    const [, record, players, rounds, attendance] = await Promise.all([
      repository.getGroup(session.groupId), repository.getSession(sessionId),
      repository.listPlayers(session.groupId, { includeInactive: true }),
      repository.listStartedRounds(sessionId), repository.listAttendance(sessionId),
    ]);
    return { session: record, players, rounds, attendance };
  };
  const fixture = await loadInputs();
  assert.ok(fixture.rounds.some(round => round.matches.length > 0), "Fixture needs populated history");
  const expected = service.proposeRoundFromSnapshot(fixture, 42, 0);
  assert.deepEqual(await service.proposeRound(sessionId, 42, 0), expected);
  for (let iteration = 0; iteration < 7; iteration++) {
    for (const variant of iteration % 2 ? ["reused", "duplicate"] : ["duplicate", "reused"]) {
      queries = 0; capture = true;
      const start = performance.now();
      const snapshot = await loadInputs();
      const actual = variant === "duplicate" ? await service.proposeRound(sessionId, 42, 0) : service.proposeRoundFromSnapshot(snapshot, 42, 0);
      const ms = performance.now() - start;
      capture = false;
      assert.deepEqual(snapshot, fixture);
      assert.deepEqual(actual, expected);
      assert.equal(queries, variant === "duplicate" ? 15 : 8);
      const sample = { variant, iteration, ms, queries };
      samples.push(sample);
      console.log(JSON.stringify(sample));
    }
  }
  const summary = Object.fromEntries(["duplicate", "reused"].map(variant => {
    const times = samples.filter(sample => sample.variant === variant).map(sample => sample.ms).sort((a, b) => a - b);
    return [variant, { n: times.length, medianMs: times[3], minMs: times[0], maxMs: times.at(-1) }];
  }));
  const output = { sessionId, poolSize: 10, database: "Neon test branch; SELECTs only", scope: "Proposal preparation read sequence; not full page render", rounds: fixture.rounds.length,
    matches: fixture.rounds.reduce((sum, round) => sum + round.matches.length, 0), samples, summary };
  const target = resolve(resultPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally { await sql.end(); }
