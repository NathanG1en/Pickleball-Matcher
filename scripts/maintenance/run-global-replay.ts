import fs from "node:fs";
import postgres from "postgres";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories";
import { replayRatingsAndSynergies } from "../../src/lib/domain/synergy-replay";
import { formatDupr, formatDuprDelta } from "../../src/lib/domain/rating-display";

if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("Error: DATABASE_URL is required in .env or environment.");
  process.exit(1);
}

// Strip unsupported channel_binding parameter for postgres.js if present
const cleanUrl = rawUrl
  .replace(/([?&])channel_binding=[^&]*(&|$)/, "$1")
  .replace(/[?&]$/, "");

const isDryRun = process.argv.includes("--dry-run");

class RollbackSentinel extends Error {
  constructor() {
    super("Rollback requested for dry-run");
  }
}

async function main() {
  const sql = postgres(cleanUrl, {
    max: 1,
    connect_timeout: 15,
    idle_timeout: 10,
    prepare: false,
  });

  try {
    console.log(`Connecting to database...`);
    const dbInfo = await sql<{ db: string; user: string }[]>`
      select current_database() as db, session_user as user
    `;
    console.log(`Connected to database "${dbInfo[0]?.db}" as "${dbInfo[0]?.user}".`);
    console.log(`Mode: ${isDryRun ? "DRY-RUN (will rollback changes)" : "APPLY (will commit changes to database)"}\n`);

    // Baseline stats
    const [playersBefore, accountsBefore, matchesBefore, synergiesBefore] = await Promise.all([
      sql<{ id: string; name: string; account_id: string | null; rating: number; rated_games_played: number }[]>`
        select id, name, account_id, rating, rated_games_played from players
      `,
      sql<{ id: string; username: string; name: string; rating: number; rated_games_played: number }[]>`
        select id, username, name, rating, rated_games_played from player_accounts
      `,
      sql<{ count: string }[]>`
        select count(*) as count from matches where status = 'completed'
      `,
      sql<{ count: string }[]>`
        select count(*) as count from player_synergy
      `,
    ]);

    const playerMapBefore = new Map(playersBefore.map(p => [p.id, p]));
    const accountMapBefore = new Map(accountsBefore.map(a => [a.id, a]));

    console.log(`Baseline Statistics:`);
    console.log(`  - Total Roster Players: ${playersBefore.length}`);
    console.log(`  - Total Player Accounts: ${accountsBefore.length}`);
    console.log(`  - Total Completed Matches: ${matchesBefore[0]?.count}`);
    console.log(`  - Current Synergy Pairs: ${synergiesBefore[0]?.count}\n`);

    console.log("Starting global replay of ratings and synergies...");
    const startTime = Date.now();

    const accountChanges: {
      id: string;
      username: string;
      name: string;
      oldElo: number;
      newElo: number;
      oldGames: number;
      newGames: number;
    }[] = [];

    const unlinkedPlayerChanges: {
      id: string;
      name: string;
      oldElo: number;
      newElo: number;
      oldGames: number;
      newGames: number;
    }[] = [];

    let synergiesAfterCount = 0;

    const repository = new PostgresRepositories(sql);

    try {
      await repository.transaction(async (tx) => {
        await replayRatingsAndSynergies("", tx);

        // Fetch post-replay values inside the transaction to inspect deltas
        const txSql = (tx as unknown as { query: postgres.Sql }).query;

        const [playersAfter, accountsAfter, synergiesAfter] = await Promise.all([
          txSql<{ id: string; name: string; account_id: string | null; rating: number; rated_games_played: number }[]>`
            select id, name, account_id, rating, rated_games_played from players
          `,
          txSql<{ id: string; username: string; name: string; rating: number; rated_games_played: number }[]>`
            select id, username, name, rating, rated_games_played from player_accounts
          `,
          txSql<{ count: string }[]>`
            select count(*) as count from player_synergy
          `,
        ]);

        synergiesAfterCount = Number(synergiesAfter[0]?.count ?? 0);

        for (const account of accountsAfter) {
          const prev = accountMapBefore.get(account.id);
          if (!prev) continue;
          if (Math.round(prev.rating) !== Math.round(account.rating) || prev.rated_games_played !== account.rated_games_played) {
            accountChanges.push({
              id: account.id,
              username: account.username,
              name: account.name,
              oldElo: prev.rating,
              newElo: account.rating,
              oldGames: prev.rated_games_played,
              newGames: account.rated_games_played,
            });
          }
        }

        for (const player of playersAfter) {
          // If player has an account, it's already tracked under accountChanges
          if (player.account_id) continue;
          const prev = playerMapBefore.get(player.id);
          if (!prev) continue;
          if (Math.round(prev.rating) !== Math.round(player.rating) || prev.rated_games_played !== player.rated_games_played) {
            unlinkedPlayerChanges.push({
              id: player.id,
              name: player.name,
              oldElo: prev.rating,
              newElo: player.rating,
              oldGames: prev.rated_games_played,
              newGames: player.rated_games_played,
            });
          }
        }

        if (isDryRun) {
          throw new RollbackSentinel();
        }
      });
    } catch (err) {
      if (err instanceof RollbackSentinel) {
        console.log("Replay transaction rolled back successfully (Dry-Run mode).\n");
      } else {
        throw err;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Replay calculation completed in ${duration}s.\n`);

    console.log("=================================================");
    console.log(isDryRun ? " REPLAY RESULTS (DRY RUN - NOT COMMITTED)" : " REPLAY RESULTS (COMMITTED TO DATABASE)");
    console.log("=================================================");
    console.log(`Account Rating Adjustments (${accountChanges.length} accounts):`);
    if (accountChanges.length === 0) {
      console.log("  (No account rating changes detected)");
    } else {
      for (const change of accountChanges) {
        const deltaElo = change.newElo - change.oldElo;
        const deltaEloStr = deltaElo >= 0 ? `+${Math.round(deltaElo)}` : `${Math.round(deltaElo)}`;
        const deltaDuprStr = formatDuprDelta(deltaElo);
        console.log(
          `  • ${change.name} (@${change.username}): ` +
          `ELO ${Math.round(change.oldElo)} -> ${Math.round(change.newElo)} (${deltaEloStr}) | ` +
          `DUPR ${formatDupr(change.oldElo)} -> ${formatDupr(change.newElo)} (${deltaDuprStr}) | ` +
          `Games: ${change.oldGames} -> ${change.newGames}`
        );
      }
    }

    if (unlinkedPlayerChanges.length > 0) {
      console.log(`\nGuest / Unlinked Player Adjustments (${unlinkedPlayerChanges.length} players):`);
      for (const change of unlinkedPlayerChanges) {
        const deltaElo = change.newElo - change.oldElo;
        const deltaEloStr = deltaElo >= 0 ? `+${Math.round(deltaElo)}` : `${Math.round(deltaElo)}`;
        const deltaDuprStr = formatDuprDelta(deltaElo);
        console.log(
          `  • ${change.name}: ` +
          `ELO ${Math.round(change.oldElo)} -> ${Math.round(change.newElo)} (${deltaEloStr}) | ` +
          `DUPR ${formatDupr(change.oldElo)} -> ${formatDupr(change.newElo)} (${deltaDuprStr}) | ` +
          `Games: ${change.oldGames} -> ${change.newGames}`
        );
      }
    }

    console.log(`\nChemistry / Synergy Pairs:`);
    console.log(`  Before: ${synergiesBefore[0]?.count}`);
    console.log(`  After:  ${synergiesAfterCount}`);

    console.log("\n=================================================");
    if (isDryRun) {
      console.log("Dry run finished. No changes were made to the database.");
    } else {
      console.log("Replay successfully applied to the production database!");
    }
    console.log("=================================================\n");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Fatal replay error:", err);
  process.exit(1);
});
