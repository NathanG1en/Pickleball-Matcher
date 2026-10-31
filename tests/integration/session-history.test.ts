import postgres from "postgres";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { expectedSessionHistory, seedSessionHistory } from "../fixtures/session-history";

let count = 0;
let capture = false;
const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) count++; } });
const repository = new PostgresRepositories(sql);
beforeAll(async () => {
  for (const table of ["groups", "players", "sessions", "session_attendance", "rounds", "matches", "match_players", "round_sits"]) {
    await sql.unsafe(`create temporary table ${table} (like public.${table} including all)`);
  }
  const [isolation] = await sql`select c.relnamespace = pg_my_temp_schema() as isolated from pg_class c where c.oid = 'matches'::regclass`;
  if (!isolation?.isolated) throw new Error("Temporary table isolation failed");
  await seedSessionHistory(repository);
});
afterAll(async () => { await sql.end(); });

it("returns fully mapped, ordered history without leaking another session's children", async () => {
  count = 0; capture = true;
  const history = await repository.listStartedRounds("history-main");
  capture = false;
  expect(history).toEqual(expectedSessionHistory);
  expect(count).toBe(4);
});

it.each(["history-empty", "missing"])("returns no rounds for %s with one query", async sessionId => {
  count = 0; capture = true;
  const history = await repository.listStartedRounds(sessionId);
  capture = false;
  expect(history).toEqual([]);
  expect(count).toBe(1);
});

it("retains a round without matches, participants, or sitters", async () => {
  count = 0; capture = true;
  const history = await repository.listStartedRounds("history-only-empty");
  capture = false;
  expect(history).toEqual([{ ...expectedSessionHistory[2], round: {
    ...expectedSessionHistory[2].round, id: "only-empty-round", sessionId: "history-only-empty", roundNumber: 1,
  } }]);
  expect(count).toBeLessThanOrEqual(4);
});

it("reads uncommitted history through the transaction connection and preserves rollback", async () => {
  const rollback = new Error("Rollback fixture edit");
  await expect(repository.transaction(async transaction => {
    await transaction.updateMatch({ ...expectedSessionHistory[0].matches[0], team2Score: 9, version: 4 });
    const history = await transaction.listStartedRounds("history-main");
    expect(history[0].matches[0]).toMatchObject({ team2Score: 9, version: 4 });
    expect(history[0].matchPlayers).toEqual(expectedSessionHistory[0].matchPlayers);
    expect(history[1]).toEqual(expectedSessionHistory[1]);
    throw rollback;
  })).rejects.toBe(rollback);
  expect(await repository.listStartedRounds("history-main")).toEqual(expectedSessionHistory);
});
