import postgres from "postgres";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { replayRatings } from "@/lib/domain/rating-replay";
import { replayRatingsAndSynergies, replaySynergies } from "@/lib/domain/synergy-replay";
import { SessionService } from "@/lib/domain/session-service";
import { batchNow } from "../fixtures/batch-scores";
import { createReplayTables, persistedReplayState, seedReplayHistory } from "../fixtures/postgres-replay";

let queries = 0;
let capture = false;
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^ep-cold-band-b491lrgj\./.test(new URL(testUrl).hostname)) throw new Error("Temporary replay tests require the allowlisted direct test endpoint");
const sql = postgres(testUrl, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const repository = new PostgresRepositories(sql);
beforeAll(async () => {
  await createReplayTables(sql);
  await seedReplayHistory(repository);
  // A shared account in another group remains part of global replay outputs.
  await repository.insertGroup({ id: "shared-group", name: "Shared", organizerPinHash: "fixture", createdAt: batchNow });
  const original = (await repository.listPlayers("batch-group"))[0];
  await repository.createPlayer({ ...original, id: "shared-roster-player", groupId: "shared-group", active: false });
}, 30_000);
afterAll(async () => { await sql.end(); });

it("matches the legacy persisted outputs while removing exactly two global reads", async () => {
  async function run(shared: boolean) {
    queries = 0; capture = true;
    try {
      await repository.transaction(async transaction => {
        await transaction.lockSynergyState();
        if (shared) await replayRatingsAndSynergies("batch-group", transaction);
        else { await replayRatings("batch-group", transaction); await replaySynergies(transaction); }
      });
      return queries;
    } finally { capture = false; }
  }
  const legacyQueries = await run(false);
  const expected = await persistedReplayState(sql);
  const optimizedQueries = await run(true);
  expect(await persistedReplayState(sql)).toEqual(expected);
  expect(optimizedQueries).toBe(legacyQueries - 2);
  const roster = await repository.listPlayers(undefined, { includeInactive: true });
  expect(roster.find(player => player.id === "shared-roster-player")?.rating).toEqual(roster.find(player => player.id === "batch-player-0")?.rating);
});

it("rolls back source, rating, snapshot and chemistry writes when the final write fails", async () => {
  const before = await persistedReplayState(sql);
  const original = PostgresRepositories.prototype.replaceSynergyState;
  const fault = vi.spyOn(PostgresRepositories.prototype, "replaceSynergyState").mockImplementationOnce(async function (this: PostgresRepositories, records) {
    await original.call(this, records);
    throw new Error("Failure after chemistry persistence");
  });
  try {
    const service = new SessionService(repository, { now: () => batchNow, nextSeed: () => 1, nextId: kind => kind });
    await expect(service.recordResult({ matchId: "batch-match-0", team1Score: 0, team2Score: 11 })).rejects.toThrow("Failure after chemistry persistence");
  } finally { fault.mockRestore(); }
  expect(await persistedReplayState(sql)).toEqual(before);
});

it("holds the same chemistry lock until the transaction finishes", async () => {
  const contender = postgres(testUrl!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await repository.transaction(async transaction => {
      await transaction.lockSynergyState();
      await replayRatingsAndSynergies("batch-group", transaction);
      const [result] = await contender`select pg_try_advisory_xact_lock(hashtextextended('pickleball:synergy-state', 0)) as acquired`;
      expect(result.acquired).toBe(false);
    });
    const [result] = await contender`select pg_try_advisory_xact_lock(hashtextextended('pickleball:synergy-state', 0)) as acquired`;
    expect(result.acquired).toBe(true);
  } finally { await contender.end(); }
});
