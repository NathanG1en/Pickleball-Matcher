import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
afterAll(async () => { await sql.end(); });
it("migrates isolated session storage and round-trips pair settings with defaults and version checks", async () => {
  await sql.begin(async tx => {
    await tx.unsafe("create temporary table sessions (like public.sessions including all) on commit drop");
    // ALTER targets the temporary table, never public.sessions.
    await tx.unsafe(readFileSync("migrations/202610260001_stay_together_pairs.sql", "utf8"));
    const repository = new PostgresRepositories(sql, tx);
    const session = { id: "stay-fixture", groupId: "group-fixture", courtCount: 1, status: "active" as const, currentRoundNumber: 0, version: 1, startedAt: new Date(), endedAt: null };
    await repository.insertSession(session, []);
    expect((await repository.getSession(session.id))?.stayTogetherPairs).toEqual([]);
    await repository.updateSession({ ...session, version: 2, stayTogetherPairs: [["a", "b"]] });
    expect((await repository.listSessions(session.groupId))[0].stayTogetherPairs).toEqual([["a", "b"]]);
    await expect(repository.updateSession({ ...session, version: 2, stayTogetherPairs: [] })).rejects.toThrow(/changed/i);
  });
});
