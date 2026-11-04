// Child process loads the selected source tree with its own TypeScript aliases.
import postgres from "postgres";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { batchNow, seedBatchScores } from "./batch-scores";
import { createReplayTables, persistedReplayState } from "./postgres-replay";
import { requireReplayTestUrl } from "./replay-database";
const source = process.env.SESSION_ORACLE_SOURCE;
if (!source) throw new Error("An explicit source tree is required");
const uri = requireReplayTestUrl(process.env.TEST_DATABASE_URL, process.env.DISPOSABLE_POSTGRES_TESTS === "1");
const { PostgresRepositories }: typeof import("../../src/lib/db/postgres-repositories") = await import(pathToFileURL(resolve(source, "src/lib/db/postgres-repositories.ts")).href);
const { SessionService }: typeof import("../../src/lib/domain/session-service") = await import(pathToFileURL(resolve(source, "src/lib/domain/session-service.ts")).href);
const { createDatabase }: typeof import("../../src/lib/db/server-database") = await import(pathToFileURL(resolve(source, "src/lib/db/server-database.ts")).href);
async function runScenario(prepare: boolean) {
  // One connection keeps TEMP shadow tables pinned; real max10 multi-connection
  // behavior is exercised by the independent-organizer E2E tests.
  const sql = postgres(uri, { prepare, max: 1, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });
  try {
    await createReplayTables(sql);
    const repository = new PostgresRepositories(sql);
    const { inputs } = await seedBatchScores(repository, 3);
    await sql`update groups set owner_account_id='batch-account-0' where id='batch-group'`;
    await repository.addGroupOrganizer("batch-group", "batch-account-1");
    await repository.insertGroup({ id: "shared-group", name: "Shared", ownerAccountId: "batch-account-0", organizerPinHash: "fixture", createdAt: batchNow });
    const roster = await repository.listPlayers("batch-group");
    for (const player of roster) await repository.createPlayer({ ...player, id: `shared-${player.id}`, groupId: "shared-group" });
    await repository.insertGroup({ id: "inactive-group", name: "Inactive aliases", organizerPinHash: "fixture", createdAt: batchNow });
    await repository.createPlayer({ ...roster[0], id: "inactive-alias", groupId: "inactive-group", active: false });
    let sequence = 0;
    let clock = batchNow.getTime() + 60_000;
    const service = new SessionService(repository, { now: () => new Date(clock), nextId: kind => `${kind}-equivalence-${++sequence}`, nextSeed: () => 515151 });
    const states: unknown[] = [];
    const snapshot = async (step: string, result?: unknown) => {
      const state = {
        ...await persistedReplayState(sql),
        sessions: await sql`select * from sessions order by id`,
        rounds: await sql`select * from rounds order by id`,
        attendance: await sql`select * from session_attendance order by session_id,player_id`,
        sits: await sql`select * from round_sits order by round_id,player_id`,
        mainHistory: await repository.listStartedRounds("batch-session"),
        mainOrganizers: await repository.listGroupOrganizers("batch-group"),
        permissions: await Promise.all(["batch-account-0", "batch-account-1", "batch-account-2", "missing"].map(id => repository.isGroupOrganizer("batch-group", id))),
      };
      states.push({ step, result, state }); clock += 60_000;
      return state;
    };
    await snapshot("initial");
    await snapshot("save three courts", await service.recordMultipleResults(inputs, { groupId: "batch-group", sessionId: "batch-session" }));
    const beforeStale = await snapshot("before stale scores");
    await assert.rejects(service.recordMultipleResults(inputs, { groupId: "batch-group", sessionId: "batch-session" }));
    assert.deepEqual(await snapshot("after stale scores"), beforeStale);
    await snapshot("complete first round", await service.completeRound("batch-round"));
    const proposal = await service.proposeRound("batch-session", 421);
    await snapshot("next proposal", proposal);
    const current = (await repository.getSession("batch-session"))!;
    const second = await service.startRound(current.id, proposal, current.version);
    await snapshot("confirm and start", second);
    const currentMatches = (await repository.listStartedRounds(current.id)).find(item => item.round.id === second.id)!.matches;
    await snapshot("save second three courts", await service.recordMultipleResults(currentMatches.map(match => ({ matchId: match.id, matchVersion: match.version, team1Score: 7, team2Score: 11 }))));
    await snapshot("complete second round", await service.completeRound(second.id));
    // Preserve the existing accepted Next Round retry/version behavior exactly.
    await snapshot("repeat completion", await service.completeRound(second.id));
    await snapshot("attendance away", await service.changeAttendance({ sessionId: current.id, playerId: roster[0].id, present: false }));
    await snapshot("attendance returns", await service.changeAttendance({ sessionId: current.id, playerId: roster[0].id, present: true }));
    const shared = await service.startSession({ groupId: "shared-group", courtCount: 3, playerIds: roster.map(player => `shared-${player.id}`) });
    await snapshot("shared account session", shared);
    const sharedProposal = await service.proposeRound(shared.id, 422);
    await snapshot("shared proposal", sharedProposal);
    const sharedRound = await service.startRound(shared.id, sharedProposal, shared.version);
    await snapshot("shared round", sharedRound);
    const sharedMatches = (await repository.listStartedRounds(shared.id))[0].matches;
    await snapshot("shared scores", await service.recordMultipleResults(sharedMatches.map(match => ({ matchId: match.id, matchVersion: match.version, team1Score: 11, team2Score: 3 }))));
    await snapshot("shared chemistry", await service.completeRound(sharedRound.id));
    await snapshot("historical correction", await service.recordResult({ matchId: "batch-match-0", team1Score: 0, team2Score: 11 }));
    await snapshot("historical cancellation", await service.cancelMatch("batch-match-1"));
    await repository.removeGroupOrganizer("batch-group", "batch-account-1");
    await snapshot("permission revoked");
    return states;
  } finally { await sql.end(); }
}

const configured = createDatabase(uri);
const prepare = configured.options.prepare;
await configured.end();
process.stdout.write(JSON.stringify(await runScenario(prepare)));
