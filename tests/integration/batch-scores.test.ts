import postgres from "postgres";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PostgresRepositories, RepositoryConflictError } from "@/lib/db/postgres-repositories";
import { SessionService } from "@/lib/domain/session-service";
import { batchNow, seedBatchScores } from "../fixtures/batch-scores";

let sql: postgres.Sql;
let repository: PostgresRepositories;
let capturing = false;
let queries = 0;

beforeEach(async () => {
  // One persistent connection: temporary tables also shadow public tables in
  // the real repository's BEGIN/COMMIT transactions. No public rows are changed.
  sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capturing) queries++; } });
  for (const table of ["groups", "player_accounts", "players", "group_organizers", "sessions", "session_attendance", "rounds", "matches", "match_players", "round_sits", "player_synergy"]) {
    await sql.unsafe(`create temporary table ${table} (like public.${table} including all)`);
  }
  const [isolation] = await sql`select c.relnamespace = pg_my_temp_schema() as isolated from pg_class c where c.oid = 'matches'::regclass`;
  if (!isolation?.isolated) throw new Error("Temporary table isolation failed; refusing fixture writes");
  repository = new PostgresRepositories(sql);
});

it("rolls back partial bulk version/missing-row conflicts and preserves nullable fields and rated flags", async () => {
  const { matches } = await seedBatchScores(repository, 2);
  const updates = matches.map(match => ({ ...match, status: "completed" as const, team1Score: 11, team2Score: 7, completedAt: batchNow, version: 2 }));
  await expect(repository.updateMatches([updates[0], { ...updates[1], version: 3 }])).rejects.toBeInstanceOf(RepositoryConflictError);
  expect((await repository.getMatch(matches[0].id))?.version).toBe(1);
  expect((await repository.getMatch(matches[1].id))?.status).toBe("pending");
  await expect(repository.updateMatches([updates[0], { ...updates[1], id: "missing" }])).rejects.toBeInstanceOf(RepositoryConflictError);
  expect((await repository.getMatch(matches[0].id))?.version).toBe(1);
  await repository.updateMatches([{ ...updates[0], status: "cancelled", team1Score: null, team2Score: null, completedAt: null, rated: false }, updates[1]]);
  expect(await repository.getMatch(matches[0].id)).toMatchObject({ status: "cancelled", rated: false, team1Score: null, team2Score: null, completedAt: null, version: 2 });
  expect(await repository.getMatch(matches[1].id)).toMatchObject({ status: "completed", rated: true, team1Score: 11, completedAt: batchNow, version: 2 });
});
afterEach(async () => { capturing = false; await sql.end(); });

it.each([4, 6])("saves %i courts with a constant SQL budget and correct rating snapshots", async courts => {
  const { inputs } = await seedBatchScores(repository, courts);
  const service = new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });
  queries = 0;
  capturing = true;
  const start = performance.now();
  const results = await service.recordMultipleResults([...inputs].reverse());
  const elapsed = performance.now() - start;
  capturing = false;
  console.log(JSON.stringify({ courts, queries, ms: Math.round(elapsed) }));
  expect(results.map(match => match.id)).toEqual([...inputs].reverse().map(input => input.matchId));
  expect(results.every(match => match.status === "completed" && match.version === 2)).toBe(true);
  const players = await repository.listPlayers("batch-group");
  expect(players.find(player => player.id === "batch-player-0")).toMatchObject({ rating: 1020, ratedGamesPlayed: 1 });
  expect(players.find(player => player.id === "batch-player-2")).toMatchObject({ rating: 980, ratedGamesPlayed: 1 });
  const rounds = await repository.listStartedRounds("batch-session");
  expect(rounds[0].matchPlayers.find(member => member.playerId === "batch-player-0")).toMatchObject({ ratingBefore: 1000, ratingAfter: 1020 });
  expect(queries).toBeLessThanOrEqual(12);
});

it("rolls scores, account ratings, and match snapshots back if replay fails after writing", async () => {
  const { inputs } = await seedBatchScores(repository, 2);
  const original = PostgresRepositories.prototype.replaceRatingState;
  const fault = vi.spyOn(PostgresRepositories.prototype, "replaceRatingState").mockImplementationOnce(async function (this: PostgresRepositories, ...args) {
    await original.apply(this, args);
    throw new Error("Injected failure after rating writes");
  });
  const service = new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });
  try {
    await expect(service.recordMultipleResults(inputs)).rejects.toThrow("Injected failure after rating writes");
  } finally { fault.mockRestore(); }
  const [round] = await repository.listStartedRounds("batch-session");
  expect(round.matches.every(match => match.status === "pending" && match.version === 1 && match.team1Score === null)).toBe(true);
  expect(round.matchPlayers.every(member => member.ratingBefore === null && member.ratingAfter === null)).toBe(true);
  expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 1000, ratedGamesPlayed: 0 });
  expect(await repository.getPairSynergy("batch-account-0", "batch-account-1")).toBeNull();
});

it("rebuilds historical chemistry once while preserving timestamps and unrated court ratings", async () => {
  const { inputs, matches } = await seedBatchScores(repository, 2);
  await repository.updateMatch({ ...matches[1], rated: false, version: 2 });
  const service = new SessionService(repository, { now: () => batchNow, nextId: kind => kind, nextSeed: () => 1 });
  const saved = await service.recordMultipleResults(inputs.map((input, i) => ({ ...input, matchVersion: i === 1 ? 2 : 1 })));
  await service.completeRound("batch-round");
  expect(await repository.getPairSynergy("batch-account-0", "batch-account-1")).toMatchObject({ matchesPlayed: 1, wins: 1 });
  const later = new SessionService(repository, { now: () => new Date("2026-11-02T12:00:00Z"), nextId: kind => kind, nextSeed: () => 1 });
  await later.recordMultipleResults(saved.map(match => ({ matchId: match.id, team1Score: 0, team2Score: 11, matchVersion: match.version })));
  expect((await repository.getMatch(matches[0].id))?.completedAt).toEqual(batchNow);
  expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 980, ratedGamesPlayed: 1 });
  expect(await repository.getPlayerAccount("batch-account-4")).toMatchObject({ rating: 1000, ratedGamesPlayed: 0 });
  const pair = await repository.getPairSynergy("batch-account-0", "batch-account-1");
  expect(pair).toMatchObject({ matchesPlayed: 1, wins: 0 });
  expect(pair!.synergyScore).toBeLessThan(0);
  expect(await repository.getPairSynergy("batch-account-4", "batch-account-5")).toBeNull();
});
