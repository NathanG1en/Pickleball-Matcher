import postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import type { PlayerSynergyRecord } from "@/lib/domain/types";

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
afterAll(async () => { await sql.end(); });

it("atomically replaces chemistry, including stale pair removal and weighted state", async () => {
  // All mutations target a connection-local TEMP table, never public.player_synergy.
  await sql.begin(async (transaction) => {
    await transaction.unsafe("create temporary table player_synergy (like public.player_synergy including all) on commit drop");
    const repository = new PostgresRepositories(sql, transaction);
    const record: PlayerSynergyRecord = {
      accountId1: "a", accountId2: "b", matchesPlayed: 2, wins: 1, synergyScore: -2,
      weightSum: 1.8, contributionSum: -0.3, weightSqSum: 1.7, updatedAt: new Date("2026-10-26T12:00:00Z"),
    };
    await repository.replaceSynergyState([record]);
    expect(await repository.getPairSynergy("b", "a")).toMatchObject({ matchesPlayed: 2, wins: 1, synergyScore: -2 });
    const rows = await transaction.unsafe("select weight_sum, contribution_sum, weight_sq_sum from player_synergy");
    expect(rows[0]).toMatchObject({ weight_sum: 1.8, contribution_sum: -0.3, weight_sq_sum: 1.7 });
    await repository.replaceSynergyState([{ ...record, accountId1: "c", accountId2: "d" }]);
    expect(await repository.getPairSynergy("a", "b")).toBeNull();
    expect(await repository.getPairSynergy("c", "d")).not.toBeNull();
    await repository.replaceSynergyState([]);
    expect(await transaction.unsafe("select * from player_synergy")).toHaveLength(0);
  });
});
