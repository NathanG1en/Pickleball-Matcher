import postgres from "postgres";
import { requireReplayTestUrl } from "../fixtures/replay-database";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import type { RatingSnapshot } from "@/lib/domain/types";
import { batchNow, seedBatchScores, addOtherSessionMatch } from "../fixtures/batch-scores";
import { createReplayTables, persistedReplayState } from "../fixtures/postgres-replay";
import { legacyReplaceRatingState } from "../fixtures/legacy-rating-persistence";

let sql: postgres.Sql;
let repository: PostgresRepositories;
let capturing = false;
let queries = 0;
beforeEach(async () => {
  const uri = requireReplayTestUrl(process.env.TEST_DATABASE_URL, process.env.DISPOSABLE_POSTGRES_TESTS === "1");
  sql = postgres(uri, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capturing) queries++; } });
  await createReplayTables(sql);
  repository = new PostgresRepositories(sql);
  await seedBatchScores(repository, 1);
});
afterEach(async () => { capturing = false; await sql?.end(); });
const player = async (id: string) => (await sql`
  select rating, rated_games_played as "ratedGamesPlayed", active from players where id = ${id}
`)[0];
const snapshot = (playerId: string, ratingBefore: number, ratingAfter: number): RatingSnapshot => ({ playerId, ratingBefore, ratingAfter });
async function versions() {
  return {
    accounts: await sql`select id, ctid::text as version from player_accounts order by id`,
    players: await sql`select id, ctid::text as version from players order by id`,
    snapshots: await sql`select match_id, player_id, ctid::text as version from match_players order by match_id, player_id`,
  };
}

it("persists shared accounts, guests, and snapshots in one statement without rewriting unchanged rows", async () => {
  const players = [{ id: "batch-player-0", accountId: "batch-account-0", rating: 1020, ratedGamesPlayed: 1 }];
  const snapshots = new Map([["batch-match-0", [snapshot("batch-player-0", 1000, 1020)]]]);
  queries = 0; capturing = true;
  await repository.replaceRatingState("batch-group", players, snapshots);
  capturing = false;
  expect(queries).toBe(1);
  expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 1020, ratedGamesPlayed: 1 });
  const before = await versions();
  await repository.replaceRatingState("batch-group", players, snapshots);
  expect(await versions()).toEqual(before);
});

it("preserves last supplied account precedence, propagates to inactive aliases, and updates guests independently", async () => {
  await repository.insertGroup({ id: "other-group", name: "Other", organizerPinHash: "fixture", createdAt: batchNow });
  await repository.createPlayer({ id: "alias", accountId: "batch-account-0", groupId: "other-group", name: "Alias", initialRating: 1000, rating: 900, ratedGamesPlayed: 0, active: false });
  await repository.createPlayer({ id: "guest", groupId: "other-group", name: "Guest", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
  const players = [
    { id: "batch-player-0", accountId: "batch-account-0", rating: 1090, ratedGamesPlayed: 2 },
    { id: "alias", accountId: "batch-account-0", rating: 1120, ratedGamesPlayed: 3 },
    { id: "guest", rating: 980, ratedGamesPlayed: 1 },
  ];
  await repository.replaceRatingState("batch-group", players, new Map());
  expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3 });
  expect(await player("batch-player-0")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3 });
  expect(await player("alias")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3, active: false });
  expect(await player("guest")).toMatchObject({ rating: 980, ratedGamesPlayed: 1 });
  await sql`update players set rating = 900 where id = 'alias'`;
  const accounts = (await versions()).accounts;
  await repository.replaceRatingState("batch-group", [players[1]], new Map());
  expect((await versions()).accounts).toEqual(accounts);
  expect(await player("alias")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3 });
});

it("clears only scoped stale snapshots, applies supplied foreign snapshots, and preserves null values", async () => {
  await addOtherSessionMatch(repository, true);
  await repository.updateMatchPlayers("other-match", [
    { matchId: "other-match", playerId: "batch-player-0", team: 1, ratingBefore: 800, ratingAfter: 820 },
    { matchId: "other-match", playerId: "batch-player-1", team: 2, ratingBefore: 900, ratingAfter: 880 },
  ]);
  await sql`update match_players set rating_before = null, rating_after = 222 where match_id = 'batch-match-0'`;
  await repository.replaceRatingState("batch-group", [], new Map([
    ["batch-match-0", [snapshot("batch-player-0", 1000, 1020)]],
    ["other-match", [snapshot("batch-player-0", 990, 1010)]],
  ]));
  const rows = await sql`select match_id, player_id, rating_before, rating_after from match_players order by match_id, player_id`;
  expect(rows.map(row => [row.match_id, row.player_id, row.rating_before, row.rating_after])).toEqual([
    ["batch-match-0", "batch-player-0", 1000, 1020],
    ["batch-match-0", "batch-player-1", null, null],
    ["batch-match-0", "batch-player-2", null, null],
    ["batch-match-0", "batch-player-3", null, null],
    ["other-match", "batch-player-0", 990, 1010],
    ["other-match", "batch-player-1", 900, 880],
  ]);
  await repository.replaceRatingState("", [], new Map());
  expect((await sql`select * from match_players`).every(row => row.rating_before === null && row.rating_after === null)).toBe(true);
  const before = await versions();
  await repository.replaceRatingState("", [], new Map());
  expect(await versions()).toEqual(before);
});

it("matches legacy outputs for guest-only updates and snapshots with empty player input", async () => {
  await repository.createPlayer({ id: "guest", groupId: "batch-group", name: "Guest", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
  const players = [{ id: "guest", rating: 980, ratedGamesPlayed: 2 }];
  const snapshots = new Map([["batch-match-0", [snapshot("batch-player-0", 1000, 1020)]]]);
  let expected: Awaited<ReturnType<typeof persistedReplayState>>;
  const rollback = new Error("rollback legacy comparison");
  await expect(sql.begin(async transaction => {
    await legacyReplaceRatingState(transaction as unknown as postgres.Sql, "batch-group", players, snapshots);
    expected = await persistedReplayState(transaction as unknown as postgres.Sql);
    throw rollback;
  })).rejects.toBe(rollback);
  await repository.replaceRatingState("batch-group", players, snapshots);
  expect(await persistedReplayState(sql)).toEqual(expected!);
  await repository.replaceRatingState("batch-group", [], new Map());
  expect((await sql`select * from match_players`).every(row => row.rating_before === null && row.rating_after === null)).toBe(true);
});

it("rolls account and roster changes back if snapshot persistence fails", async () => {
  const before = await persistedReplayState(sql);
  await sql.unsafe(`alter table match_players add constraint reject_snapshot check (rating_after is null or rating_after < 1050)`);
  await expect(repository.transaction(async transaction => {
    await transaction.lockSynergyState();
    await transaction.replaceRatingState("batch-group", [{ id: "batch-player-0", accountId: "batch-account-0", rating: 1100, ratedGamesPlayed: 2 }],
      new Map([["batch-match-0", [snapshot("batch-player-0", 1000, 1100)]]]));
  })).rejects.toMatchObject({ code: "23514" });
  expect(await persistedReplayState(sql)).toEqual(before);
});

it("uses actual roster linkage for account propagation when input account IDs are omitted or different", async () => {
  await repository.replaceRatingState("batch-group", [
    { id: "batch-player-0", rating: 1090, ratedGamesPlayed: 2 },
    { id: "batch-player-1", accountId: "batch-account-0", rating: 1120, ratedGamesPlayed: 3 },
  ], new Map());
  expect(await player("batch-player-0")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3 });
  expect(await player("batch-player-1")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3 });
  expect(await repository.getPlayerAccount("batch-account-0")).toMatchObject({ rating: 1120, ratedGamesPlayed: 3 });
  expect(await repository.getPlayerAccount("batch-account-1")).toMatchObject({ rating: 1000, ratedGamesPlayed: 0 });
});
