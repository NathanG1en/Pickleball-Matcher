// npx tsx scripts/benchmarks/round-completion.mjs [samples=15] [output]
// Explicit test endpoint; all fixture/output writes use connection-local TEMP tables.
import nextEnv from "@next/env";
import postgres from "postgres";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories.ts";
import { SessionService } from "../../src/lib/domain/session-service.ts";
import { createReplayTables, seedReplayHistory, persistedReplayState } from "../../tests/fixtures/postgres-replay.ts";
import { batchNow } from "../../tests/fixtures/batch-scores.ts";
nextEnv.loadEnvConfig(process.cwd());
const uri = process.env.TEST_DATABASE_URL;
if (!uri || !/^ep-cold-band-b491lrgj\./.test(new URL(uri).hostname)) throw Error("Expected direct allowlisted test endpoint");
const count = Number(process.argv[2] ?? 15);
if (!Number.isInteger(count) || count < 3 || count > 100) throw Error("Use 3–100 observations per variant");
const output = resolve(process.argv[3] ?? "docs/benchmarks/data/round-completion.json");
let capture = false; let queries = 0;
const sql = postgres(uri, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const repository = new PostgresRepositories(sql);
const service = new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });
const focused = PostgresRepositories.prototype.getRoundCompletionContext;
const legacy = async function (roundId) {
  const round = await this.getRound(roundId);
  if (!round) return null;
  const record = (await this.listStartedRounds(round.sessionId)).find(item => item.round.id === roundId);
  return { round, pendingMatches: record.matches.filter(match => match.status === "pending").map(match => ({
    match, playerCount: record.matchPlayers.filter(player => player.matchId === match.id).length,
  })) };
};
const observations = [];
try {
  await createReplayTables(sql);
  await seedReplayHistory(repository, 10);
  const roundId = "replay-round-9";
  const run = async (variant, iteration) => {
    PostgresRepositories.prototype.getRoundCompletionContext = variant === "legacy" ? legacy : focused;
    await sql`update rounds set status='started', completed_at=null, version=1 where id=${roundId}`;
    queries = 0; capture = true;
    const start = performance.now();
    let round;
    try { round = await service.completeRound(roundId); } finally { capture = false; }
    const elapsed = performance.now() - start;
    assert.equal(round.status, "completed"); assert.equal(round.version, 2);
    assert.equal(queries, variant === "legacy" ? 14 : 10);
    if (iteration >= 0) observations.push({ variant, iteration, ms: elapsed, queries });
    return { round, state: await persistedReplayState(sql) };
  };
  const expected = await run("legacy", -1);
  assert.deepEqual(await run("focused", -1), expected);
  for (let iteration = 0; iteration < count; iteration++) {
    for (const variant of iteration % 2 ? ["focused", "legacy"] : ["legacy", "focused"]) {
      assert.deepEqual(await run(variant, iteration), expected);
    }
    console.log(`Completed paired observation ${iteration + 1}/${count}`);
  }
  const summary = Object.fromEntries(["legacy", "focused"].map(variant => {
    const rows = observations.filter(item => item.variant === variant);
    const times = rows.map(item => item.ms).sort((a, b) => a - b);
    return [variant, { n: times.length, queries: rows[0].queries, medianMs: times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2, minMs: times[0], maxMs: times.at(-1) }];
  }));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ scope: "Backend completion only; not browser latency", database: "Test branch, connection-local temporary tables only", players: 16, courts: 4, rounds: 10,
    warmupsPerVariant: 1, order: "alternating", equality: "Completed round, matches, ratings, snapshots and chemistry after every observation", observations, summary }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
} finally { PostgresRepositories.prototype.getRoundCompletionContext = focused; await sql.end(); }
