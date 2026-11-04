// Read-only DB / CPU diagnostic, separate from primary browser latency measurements.
// npx tsx scripts/benchmarks/session-actions/diagnose.ts PRIVATE_ENV OUTPUT_JSON
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { PostgresRepositories } from "../../../src/lib/db/postgres-repositories";
import { SessionService } from "../../../src/lib/domain/session-service";
import { calculateRatingReplay } from "../../../src/lib/domain/rating-replay";
import { calculateSynergyReplay } from "../../../src/lib/domain/synergy-replay";
import { summarizeSamples } from "./timeline";

const [envPath, outputPath] = process.argv.slice(2);
assert.ok(envPath && outputPath);
const { DATABASE_URL } = parseEnv(readFileSync(envPath, "utf8"));
assert.ok(DATABASE_URL);
const url = new URL(DATABASE_URL);
assert.equal(url.hostname, "ep-summer-boat-b49oecxy-pooler.c-6.us-east-2.aws.neon.tech");
assert.match(url.pathname, /^\/goal_[a-z0-9_]+$/);
let capture = false;
const captured: { sql: string; parameters: readonly postgres.ParameterOrJSON<never>[] }[] = [];
const sql = postgres(DATABASE_URL, { max: 10, prepare: false, idle_timeout: 20, connect_timeout: 15,
  debug: (_connection, text, parameters) => { if (capture) captured.push({ sql: text, parameters }); },
});
try {
  const diagnostic = await sql.begin("read only", async transaction => {
    const repository = new PostgresRepositories(sql, transaction);
    const query = transaction as unknown as postgres.Sql;
    const groupId = "grp_current_club_profile_20261031";
    const records = await query<{ id: string }[]>`select id from sessions where group_id=${groupId} order by started_at desc,id desc limit 1`;
    assert.equal(records.length, 1);
    const session = await repository.getSession(records[0].id);
    assert.ok(session);
    const players = await repository.listPlayers(groupId);
    const attendance = await repository.listAttendance(session.id);
    const rounds = await repository.listStartedRounds(session.id);
    capture = true;
    const globalPlayers = await repository.listPlayers(undefined, { includeInactive: true });
    const history = await repository.listReplayMatches();
    capture = false;
    assert.equal(captured.length, 2);
    const explains = [];
    for (const query of captured) {
      assert.match(query.sql, /^\s*select/i);
      const start = performance.now();
      const result = await transaction.unsafe(`explain (analyze, buffers, format json) ${query.sql}`, [...query.parameters]);
      const elapsedMs = performance.now() - start;
      const plan = result[0]["QUERY PLAN"][0];
      // Do not publish query text, parameters, row values or full plans (which can embed values).
      explains.push({ name: explains.length ? "global replay history" : "global roster", roundTripMs: elapsedMs,
        planningMs: plan["Planning Time"], executionMs: plan["Execution Time"],
        actualRows: plan.Plan["Actual Rows"], sharedHitBlocks: plan.Plan["Shared Hit Blocks"], sharedReadBlocks: plan.Plan["Shared Read Blocks"] });
    }
    return { session, players, attendance, rounds, globalPlayers, history, explains };
  });
  const service = new SessionService(new PostgresRepositories(sql), { now: () => new Date("2026-11-03T00:00:00.000Z"), nextSeed: () => 1, nextId: kind => kind });
  const { session, players, attendance, rounds, globalPlayers, history, explains } = diagnostic;
  const replay = calculateRatingReplay(globalPlayers, history);
  const observations = { rating: [] as number[], chemistry: [] as number[], proposal: [] as number[] };
  for (let index = -3; index < 30; index++) {
    let start = performance.now(); calculateRatingReplay(globalPlayers, history); const rating = performance.now() - start;
    start = performance.now(); calculateSynergyReplay(globalPlayers, history, replay.snapshots); const chemistry = performance.now() - start;
    start = performance.now(); const proposal = service.proposeRoundFromSnapshot({ session, players, attendance, rounds }, 1000 + index); const proposalMs = performance.now() - start;
    assert.equal(proposal.courts.length, 3);
    assert.equal(new Set(proposal.courts.flatMap(court => [...court.team1, ...court.team2])).size, 12);
    if (index >= 0) { observations.rating.push(rating); observations.chemistry.push(chemistry); observations.proposal.push(proposalMs); }
  }
  const result = { scope: "Separate read-only diagnostic, not browser latency or request CPU attribution", counts: { players: players.length, completedSessionRounds: rounds.length, globalRoster: globalPlayers.length, globalMatches: history.length },
    explains, cpu: { warmupsPerOperation: 3, observations, summary: Object.fromEntries(Object.entries(observations).map(([key, values]) => [key, summarizeSamples(values)])) } };
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ counts: result.counts, explains, cpu: result.cpu.summary }));
} finally { await sql.end(); }
