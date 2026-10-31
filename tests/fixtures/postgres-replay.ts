import type postgres from "postgres";
import type { DomainRepository } from "@/lib/domain/repositories";
import { batchNow, seedBatchScores } from "./batch-scores";

/** Connection-local shadow tables; all writes disappear when this connection closes. */
export async function createReplayTables(sql: postgres.Sql) {
  const tables = ["groups", "player_accounts", "players", "group_organizers", "sessions", "session_attendance", "rounds", "matches", "match_players", "round_sits", "player_synergy"];
  for (const table of tables) await sql.unsafe(`create temporary table ${table} (like public.${table} including all)`);
  const namespaces = await sql<{ name: string; isolated: boolean }[]>`
    select name, (select relnamespace = pg_my_temp_schema() from pg_class where oid = to_regclass(name)) as isolated
    from unnest(${tables}::text[]) as names(name)
  `;
  if (namespaces.length !== tables.length || namespaces.some(row => !row.isolated)) throw new Error("Temporary replay table isolation failed; refusing fixture writes");
}

export async function seedReplayHistory(repository: DomainRepository, roundCount = 3) {
  const { matches, round } = await seedBatchScores(repository, 4);
  const first = await repository.listStartedRounds("batch-session");
  for (let index = 0; index < roundCount; index++) {
    const time = new Date(batchNow.getTime() + index * 60_000);
    const roundId = index === 0 ? round.id : `replay-round-${index}`;
    const saved = matches.map((match, court) => {
      const cancelled = index % 7 === 1 && court === 3;
      return { ...match,
        id: index === 0 ? match.id : `replay-match-${index}-${court}`, roundId,
        status: cancelled ? "cancelled" as const : "completed" as const,
        rated: !(index === 0 && court === 2), team1Score: cancelled ? null : index % 2 ? 5 : 11,
        team2Score: cancelled ? null : index % 2 ? 11 : 5, completedAt: time, version: 2,
      };
    });
    const updatedRound = { ...round, id: roundId, roundNumber: index + 1, status: "completed" as const, completedAt: time, version: 2 };
    if (index === 0) {
      await repository.updateMatches(saved);
      await repository.updateRound(updatedRound);
    } else {
      await repository.insertStartedRound({ round: updatedRound, matches: saved,
        matchPlayers: first[0].matchPlayers.map(member => ({ ...member, matchId: saved[matches.findIndex(match => match.id === member.matchId)].id })), sits: [] });
    }
  }
  const session = await repository.getSession("batch-session");
  await repository.updateSession({ ...session!, currentRoundNumber: roundCount, version: 2 });
}

/** Full persisted replay outputs/source matches, sorted deterministically. No data is logged. */
export async function persistedReplayState(sql: postgres.Sql) {
  const players = await sql`select id, account_id, group_id, active, initial_rating, rating, rated_games_played from players order by id`;
  const accounts = await sql`select id, initial_rating, rating, rated_games_played from player_accounts order by id`;
  const matches = await sql`select id, round_id, court_number, status, team1_score, team2_score, completed_at, version, rated from matches order by id`;
  const snapshots = await sql`select match_id, player_id, team, rating_before, rating_after from match_players order by match_id, team, player_id`;
  const chemistry = await sql`select * from player_synergy order by account_id_1, account_id_2`;
  return { players, accounts, matches, snapshots, chemistry };
}
