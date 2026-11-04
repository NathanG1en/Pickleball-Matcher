import postgres from "postgres";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { replaySynergies } from "@/lib/domain/synergy-replay";
import type { PlayerSynergyRecord } from "@/lib/domain/types";
import { createReplayTables, seedReplayHistory } from "../fixtures/postgres-replay";
import { requireReplayTestUrl } from "../fixtures/replay-database";

let sql: postgres.Sql;
let repository: PostgresRepositories;
let records: readonly PlayerSynergyRecord[];
let capture = false;
let queries = 0;
const state = () => sql`select * from player_synergy order by account_id_1, account_id_2`;
beforeEach(async () => {
  const uri = requireReplayTestUrl(process.env.TEST_DATABASE_URL, process.env.DISPOSABLE_POSTGRES_TESTS === "1");
  sql = postgres(uri, { max: 1, prepare: true, onnotice: () => {}, debug: () => { if (capture) queries++; } });
  await createReplayTables(sql);
  repository = new PostgresRepositories(sql);
  await seedReplayHistory(repository, 1, 1);
  await repository.transaction(transaction => replaySynergies(transaction));
  records = await repository.listPairSynergies(["batch-account-0", "batch-account-1", "batch-account-2", "batch-account-3"]);
  expect(records).toHaveLength(2);
});
afterEach(async () => { capture = false; await sql?.end(); });

it("replaces the complete chemistry state in one command with identical fields and timestamps", async () => {
  const before = await state();
  await repository.transaction(async transaction => {
    queries = 0; capture = true;
    try { await transaction.replaceSynergyState(records); } finally { capture = false; }
  });
  expect(queries).toBe(1);
  expect(await state()).toEqual(before);
});

it("removes absent pairs and clears all rows when replacement is empty", async () => {
  await repository.transaction(transaction => transaction.replaceSynergyState(records.slice(0, 1)));
  expect(await state()).toHaveLength(1);
  await repository.transaction(transaction => transaction.replaceSynergyState([]));
  expect(await state()).toEqual([]);
  await repository.transaction(transaction => transaction.replaceSynergyState(records));
  expect(await state()).toHaveLength(2);
});

it("rolls replacement back for duplicate keys and invalid aggregates", async () => {
  const before = await state();
  await expect(repository.transaction(transaction => transaction.replaceSynergyState([records[0], records[0]]))).rejects.toMatchObject({ code: "23505" });
  expect(await state()).toEqual(before);
  await expect(repository.transaction(transaction => transaction.replaceSynergyState([{ ...records[0], matchesPlayed: -1 }]))).rejects.toMatchObject({ code: "23514" });
  expect(await state()).toEqual(before);
});

it("requires the caller transaction before attempting any write", async () => {
  const before = await state();
  await expect(repository.replaceSynergyState(records)).rejects.toThrow("Chemistry replacement requires a transaction.");
  expect(await state()).toEqual(before);
});
