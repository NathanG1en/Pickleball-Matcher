// npx tsx scripts/benchmarks/rating-persistence.mjs [samples=15] [output]
// All fixture writes use checked, connection-local TEMP tables on the direct test endpoint.
import nextEnv from "@next/env";
import postgres from "postgres";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories.ts";
import { SessionService } from "../../src/lib/domain/session-service.ts";
import { replayRatings } from "../../src/lib/domain/rating-replay.ts";
import { batchNow } from "../../tests/fixtures/batch-scores.ts";
import { createReplayTables, seedReplayHistory, persistedReplayState } from "../../tests/fixtures/postgres-replay.ts";
import { legacyReplaceRatingState } from "../../tests/fixtures/legacy-rating-persistence.ts";

nextEnv.loadEnvConfig(process.cwd());
const uri = process.env.TEST_DATABASE_URL;
if (!uri || !/^ep-cold-band-b491lrgj\./.test(new URL(uri).hostname)) throw Error("Expected allowlisted direct test endpoint");
const count = Number(process.argv[2] ?? 15);
if (!Number.isInteger(count) || count < 3 || count > 100) throw Error("Use 3–100 samples per variant");
const output = resolve(process.argv[3] ?? "docs/benchmarks/data/rating-persistence.json");
let capture = false; let queries = 0;
const sql = postgres(uri, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const optimized = PostgresRepositories.prototype.replaceRatingState;
const variants = { optimized, legacy: function (...args) { return legacyReplaceRatingState(this.query, ...args); } };
const observations = [];
try {
  await createReplayTables(sql);
  const repository = new PostgresRepositories(sql);
  await seedReplayHistory(repository, 10, 3);
  const target = "replay-round-9";
  await sql`update rounds set status='started', completed_at=null where id=${target}`;
  await sql`update matches set status='pending', team1_score=null, team2_score=null, completed_at=null, version=1 where round_id=${target}`;
  await repository.transaction(async transaction => { await transaction.lockSynergyState(); await replayRatings("batch-group", transaction); });
  const tables = ["players", "player_accounts", "matches", "match_players"];
  for (const table of tables) await sql.unsafe(`create temporary table baseline_${table} as select * from ${table}`);
  const inputs = (await repository.listStartedRounds("batch-session")).find(record => record.round.id === target).matches.map(match => ({ matchId: match.id, matchVersion: 1, team1Score: 11, team2Score: 7 }));
  const service = new SessionService(repository, { now: () => new Date(batchNow.getTime() + 10 * 60_000), nextId: kind => kind, nextSeed: () => 1 });
  const run = async (variant, iteration) => {
    PostgresRepositories.prototype.replaceRatingState = variants[variant];
    // Restore identical starting values outside the timed interval.
    await sql`update players p set rating=b.rating, rated_games_played=b.rated_games_played from baseline_players b where p.id=b.id`;
    await sql`update player_accounts p set rating=b.rating, rated_games_played=b.rated_games_played from baseline_player_accounts b where p.id=b.id`;
    await sql`update match_players p set rating_before=b.rating_before, rating_after=b.rating_after from baseline_match_players b where p.match_id=b.match_id and p.player_id=b.player_id`;
    await sql`update matches m set status=b.status, team1_score=b.team1_score, team2_score=b.team2_score, completed_at=b.completed_at, version=b.version from baseline_matches b where m.id=b.id`;
    queries = 0; capture = true;
    const start = performance.now();
    let matches;
    try { matches = await service.recordMultipleResults(inputs); } finally { capture = false; }
    const ms = performance.now() - start;
    assert.equal(queries, variant === "legacy" ? 12 : 9);
    assert.ok(matches.every(match => match.status === "completed" && match.version === 2));
    if (iteration >= 0) observations.push({ variant, iteration, ms, queries });
    return { matches, state: await persistedReplayState(sql) };
  };
  const expected = await run("legacy", -1);
  assert.deepEqual(await run("optimized", -1), expected);
  for (let iteration = 0; iteration < count; iteration++) {
    for (const variant of iteration % 2 ? ["optimized", "legacy"] : ["legacy", "optimized"]) assert.deepEqual(await run(variant, iteration), expected);
    console.log(`Paired Save All observation ${iteration + 1}/${count}`);
  }
  const summary = Object.fromEntries(["legacy", "optimized"].map(variant => {
    const times = observations.filter(row => row.variant === variant).map(row => row.ms).sort((a, b) => a - b);
    return [variant, { samples: times.length, queries: variant === "legacy" ? 12 : 9,
      medianMs: times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2, minMs: times[0], maxMs: times.at(-1) }];
  }));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ scope: "Backend Save All only; not deployed/browser latency", database: "Direct test endpoint; connection-local temporary tables", players: 12, courts: 3, historicalRounds: 9, targetRound: 10,
    warmupsPerVariant: 1, order: "alternating", equality: "Returned scores and full persisted players, accounts, matches, snapshots and chemistry after every observation", observations, summary }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
} finally { PostgresRepositories.prototype.replaceRatingState = optimized; await sql.end(); }
