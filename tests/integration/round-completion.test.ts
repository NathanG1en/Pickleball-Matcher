import postgres from "postgres";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { SessionService } from "@/lib/domain/session-service";
import { createReplayTables } from "../fixtures/postgres-replay";
import { batchNow, seedBatchScores } from "../fixtures/batch-scores";

let sql: postgres.Sql;
let repository: PostgresRepositories;
let capture = false;
let queries = 0;
const testUrl = process.env.TEST_DATABASE_URL;
const allowlistedReplayEndpoint = !!testUrl && /^ep-cold-band-b491lrgj\./.test(new URL(testUrl).hostname);
if (!allowlistedReplayEndpoint && !process.env.CI) throw new Error("Expected direct isolated test endpoint");
const replayIt = allowlistedReplayEndpoint || !process.env.CI ? it : it.skip;
beforeEach(async () => {
  if (!allowlistedReplayEndpoint) return;
  sql = postgres(testUrl!, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) queries++; } });
  await createReplayTables(sql);
  repository = new PostgresRepositories(sql);
});
afterEach(async () => { capture = false; vi.restoreAllMocks(); await sql?.end(); });
const service = () => new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });

replayIt("loads only the selected round's pending matches with counts in one statement", async () => {
  const { round, matches } = await seedBatchScores(repository, 3);
  await repository.updateMatch({ ...matches[0], status: "cancelled", version: 2 });
  const members = (await repository.listStartedRounds("batch-session"))[0].matchPlayers;
  await repository.updateMatchPlayers(matches[1].id, members.filter(p => p.matchId === matches[1].id).slice(0, 2));
  await repository.updateMatch({ ...matches[1], rated: false, version: 2 });
  await repository.insertStartedRound({ round: { ...round, id: "other-round", roundNumber: 2 }, matches: [{ ...matches[0], id: "other-match", roundId: "other-round" }], matchPlayers: [], sits: [] });
  queries = 0; capture = true;
  const context = await repository.getRoundCompletionContext(round.id);
  capture = false;
  expect(queries).toBe(1);
  expect(context).toEqual({ round, pendingMatches: [
    { match: { ...matches[1], rated: false, version: 2 }, playerCount: 2 },
    { match: matches[2], playerCount: 4 },
  ] });
});

replayIt("preserves a round with no pending matches and distinguishes missing rounds", async () => {
  const { round, inputs, matches } = await seedBatchScores(repository, 1);
  await service().recordMultipleResults(inputs);
  expect(await repository.getRoundCompletionContext(round.id)).toEqual({ round, pendingMatches: [] });
  await repository.deleteMatch(matches[0].id);
  expect(await repository.getRoundCompletionContext(round.id)).toEqual({ round, pendingMatches: [] });
  expect(await repository.getRoundCompletionContext("missing")).toBeNull();
});

replayIt("uses the pinned transaction for fresh context reads and rolls changes back", async () => {
  const { round, matches } = await seedBatchScores(repository, 1);
  const rollback = new Error("rollback context");
  await expect(repository.transaction(async transaction => {
    await transaction.updateMatch({ ...matches[0], status: "cancelled", version: 2 });
    expect(await transaction.getRoundCompletionContext(round.id)).toEqual({ round, pendingMatches: [] });
    throw rollback;
  })).rejects.toBe(rollback);
  expect((await repository.getRoundCompletionContext(round.id))?.pendingMatches).toHaveLength(1);
});

replayIt("completes with ten SQL executions and preserves ratings, scores, and chemistry", async () => {
  const { inputs } = await seedBatchScores(repository, 3);
  await service().recordMultipleResults(inputs);
  const before = await repository.getPlayerAccount("batch-account-0");
  queries = 0; capture = true;
  await service().completeRound("batch-round");
  capture = false;
  expect(queries).toBe(10);
  expect(await repository.getPlayerAccount("batch-account-0")).toEqual(before);
  expect(await repository.getPairSynergy("batch-account-0", "batch-account-1")).toMatchObject({ matchesPlayed: 1, wins: 1 });
  expect((await repository.listStartedRounds("batch-session"))[0].matches.every(m => m.team1Score === 11 && m.team2Score === 7)).toBe(true);
});

replayIt("rolls round completion and singles cancellation back when the final chemistry write fails", async () => {
  const { matches } = await seedBatchScores(repository, 1);
  const players = (await repository.listStartedRounds("batch-session"))[0].matchPlayers;
  await repository.updateMatchPlayers(matches[0].id, players.slice(0, 2));
  const write = PostgresRepositories.prototype.replaceSynergyState;
  vi.spyOn(PostgresRepositories.prototype, "replaceSynergyState").mockImplementationOnce(async function (this: PostgresRepositories, ...args) {
    await write.apply(this, args); throw new Error("chemistry failure");
  });
  await expect(service().completeRound("batch-round")).rejects.toThrow("chemistry failure");
  expect(await repository.getRound("batch-round")).toMatchObject({ status: "started", version: 1 });
  expect(await repository.getMatch(matches[0].id)).toMatchObject({ status: "pending", version: 1 });
});

