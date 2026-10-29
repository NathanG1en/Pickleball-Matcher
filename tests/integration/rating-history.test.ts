import postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { seedRatingHistory, expectedHistoryRatings } from "../fixtures/rating-history";

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
afterAll(() => sql.end());
it("returns carried historical ratings for sessions without a rated result instead of initial or current ratings", async () => {
  await sql.begin(async transaction => {
    // All names below shadow public tables only on this transaction's connection.
    for (const table of ["groups", "player_accounts", "players", "sessions", "session_attendance", "rounds", "matches", "match_players", "round_sits"]) {
      await transaction.unsafe(`create temporary table ${table} (like public.${table} including all) on commit drop`);
    }
    const repository = new PostgresRepositories(sql, transaction);
    await seedRatingHistory(repository);
    await transaction.unsafe("update player_accounts set rating = 1120, rated_games_played = 2 where id = 'history-account'");
    const history = await repository.listPlayerSessionHistory("history-account");
    expect(Object.fromEntries(history.map(session => [session.sessionId, session.rating]))).toEqual(expectedHistoryRatings);
    expect(history.find(session => session.sessionId === "empty")).toMatchObject({ wins: 0, losses: 0 });
    expect(history.find(session => session.sessionId === "unrated")).toMatchObject({ wins: 1, losses: 0 });
  });
});
