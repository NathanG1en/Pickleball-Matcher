// Frozen pre-optimization SQL, used only with isolated temporary tables for equivalence checks.
import type postgres from "postgres";
import type { PlayerRecord, RatingSnapshot } from "@/lib/domain/types";

export async function legacyReplaceRatingState(
    sql: postgres.Sql,
    groupId: string,
    players: readonly (Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed"> & { accountId?: string | null })[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    if (players.length > 0) {
      const ids = players.map((p) => p.id);
      const ratings = players.map((p) => p.rating);
      const games = players.map((p) => p.ratedGamesPlayed);
      await sql`
        update players as p
        set rating = v.rating,
            rated_games_played = v.games
        from unnest(${ids}::text[], ${ratings}::float8[], ${games}::int[]) as v(id, rating, games)
        where p.id = v.id
      `;

      const accountMap = new Map<string, { rating: number; ratedGamesPlayed: number }>();
      for (const p of players) {
        if (p.accountId) {
          accountMap.set(p.accountId, { rating: p.rating, ratedGamesPlayed: p.ratedGamesPlayed });
        }
      }
      if (accountMap.size > 0) {
        const accountIds = [...accountMap.keys()];
        const accRatings = accountIds.map((id) => accountMap.get(id)!.rating);
        const accGames = accountIds.map((id) => accountMap.get(id)!.ratedGamesPlayed);
        await sql`
          update player_accounts as a
          set rating = v.rating,
              rated_games_played = v.games
          from unnest(${accountIds}::text[], ${accRatings}::float8[], ${accGames}::int[]) as v(account_id, rating, games)
          where a.id = v.account_id
        `;
        await sql`
          update players as p
          set rating = v.rating,
              rated_games_played = v.games
          from unnest(${accountIds}::text[], ${accRatings}::float8[], ${accGames}::int[]) as v(account_id, rating, games)
          where p.account_id = v.account_id
        `;
      }
    }

    await sql`
      update match_players mp set rating_before = null, rating_after = null
      from matches m, rounds r, sessions s
      where mp.match_id = m.id and m.round_id = r.id and r.session_id = s.id
        and ${groupId ? sql`s.group_id = ${groupId}` : sql`1=1`}
    `;

    const snapshotMatchIds: string[] = [];
    const snapshotPlayerIds: string[] = [];
    const snapshotRatingBefores: (number | null)[] = [];
    const snapshotRatingAfters: (number | null)[] = [];

    for (const [matchId, entries] of snapshots) {
      for (const entry of entries) {
        snapshotMatchIds.push(matchId);
        snapshotPlayerIds.push(entry.playerId);
        snapshotRatingBefores.push(entry.ratingBefore);
        snapshotRatingAfters.push(entry.ratingAfter);
      }
    }

    if (snapshotMatchIds.length > 0) {
      await sql`
        update match_players as mp
        set rating_before = v.rating_before,
            rating_after = v.rating_after
        from unnest(
          ${snapshotMatchIds}::text[],
          ${snapshotPlayerIds}::text[],
          ${snapshotRatingBefores}::float8[],
          ${snapshotRatingAfters}::float8[]
        ) as v(match_id, player_id, rating_before, rating_after)
        where mp.match_id = v.match_id and mp.player_id = v.player_id
      `;
    }}
