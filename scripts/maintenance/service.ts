import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories";
import { calculateRatingReplay } from "../../src/lib/domain/rating-replay";
import { duprToElo, formatDupr } from "../../src/lib/domain/rating-display";
import { MaintenanceError, type CorrectionRequest, type MaintenanceTarget } from "./options";

type RatingChange = {
  accountId: string | null;
  username: string | null;
  name: string;
  playerIds: string[];
  groupIds: string[];
  beforeElo: number;
  afterElo: number;
  beforeRating: string;
  afterRating: string;
}

async function authorize(tx: postgres.Sql) {
  const rows = await tx<{ actor: string; authorized: boolean }[]>`
    select session_user::text as actor, exists (
      select 1 from public.rating_maintenance_operators o
      join pg_catalog.pg_roles r on r.rolname = o.database_role
      where o.database_role = session_user and r.rolcanlogin
        and not (r.rolsuper or r.rolcreaterole or r.rolcreatedb or r.rolreplication or r.rolbypassrls)
        and pg_has_role(r.oid, 'pickleball_rating_maintenance', 'MEMBER')
        and not exists (select 1 from pg_catalog.pg_roles elevated
          where elevated.rolname in ('neon_superuser', 'pg_read_all_data', 'pg_write_all_data')
            and pg_has_role(r.oid, elevated.oid, 'MEMBER'))
        and not exists (select 1 from pg_catalog.pg_database d
          where d.datname = current_database() and pg_has_role(r.oid, d.datdba, 'MEMBER'))
    ) as authorized`;
  if (!rows[0]?.authorized) throw new MaintenanceError("Maintenance login is not authorized. Use a registered personal maintenance login.");
  return rows[0].actor;
}

async function verifyTarget(tx: postgres.Sql, target: MaintenanceTarget) {
  const rows = await tx`
    select environment, database_host, database_port, database_name, current_database() as actual_database
    from public.rating_maintenance_target where singleton = true`;
  const registered = rows[0];
  if (!registered || registered.environment !== target.environment || registered.database_host !== target.hostname ||
    registered.database_port !== target.port || registered.database_name !== target.database || registered.actual_database !== target.database) {
    throw new MaintenanceError("Database target does not match its owner-managed environment/host registration.");
  }
}

export async function runRatingMaintenance(database: postgres.Sql, request: CorrectionRequest, target: MaintenanceTarget) {
  if (request.environment !== target.environment) throw new MaintenanceError("Database target environment does not match the request.");
  try {
    return await database.begin(request.apply ? "read write" : "isolation level repeatable read read only", async transaction => {
      // postgres.js TransactionSql's mapped type loses its tag call signature.
      const tx = transaction as unknown as postgres.Sql;
      await tx`set local statement_timeout = '60s'`;
      await tx`set local idle_in_transaction_session_timeout = '60s'`;
      const actor = await authorize(tx);
      await verifyTarget(tx, target);
      if (request.apply) {
        await tx`select public.lock_rating_maintenance_history()`;
        // Recheck registrations after acquiring the locks; no history reads have occurred yet.
        await authorize(tx);
        await verifyTarget(tx, target);
      }
      const accounts = await tx<{ id: string; username: string; name: string; initial_rating: number; rating: number }[]>`
        select id, username, name, initial_rating, rating from public.player_accounts where username = ${request.username}`;
      const account = accounts[0];
      if (!account) throw new MaintenanceError("No account matches that exact username.");
      const newElo = duprToElo(request.startingRating);
      const expectedElo = request.expectedStartingRating === undefined ? request.expectedStartingElo : duprToElo(request.expectedStartingRating);
      if (request.apply && expectedElo !== account.initial_rating) {
        throw new MaintenanceError("Starting rating changed or was not confirmed. Preview again before applying.");
      }
      if (newElo === account.initial_rating) throw new MaintenanceError("This account already has that starting rating; no correction is needed.");

      const repository = new PostgresRepositories(database, transaction);
      const players = await repository.listPlayers(undefined, { includeInactive: true });
      const history = await repository.listReplayMatches();
      const corrected = players.map(player => player.accountId === account.id ? { ...player, initialRating: newElo } : player);
      const replay = calculateRatingReplay(corrected, history);
      const replayById = new Map(replay.players.map(player => [player.id, player]));
      const changesByEntity = new Map<string, RatingChange>();
      for (const player of players) {
        const after = replayById.get(player.id)!;
        if (player.rating === after.rating && player.accountId !== account.id) continue;
        const key = player.accountId ?? player.id;
        const change = changesByEntity.get(key) ?? {
          accountId: player.accountId ?? null, username: player.username ?? null, name: player.name,
          playerIds: [], groupIds: [], beforeElo: player.rating, afterElo: after.rating,
          beforeRating: formatDupr(player.rating), afterRating: formatDupr(after.rating),
        };
        change.playerIds.push(player.id);
        if (!change.groupIds.includes(player.groupId)) change.groupIds.push(player.groupId);
        changesByEntity.set(key, change);
      }
      const targetState = replay.players.find(player => player.accountId === account.id);
      if (!targetState) {
        changesByEntity.set(account.id, { accountId: account.id, username: account.username, name: account.name,
          playerIds: [], groupIds: [], beforeElo: account.rating, afterElo: newElo,
          beforeRating: formatDupr(account.rating), afterRating: formatDupr(newElo) });
      }
      const report = {
        applied: request.apply, correctionId: request.apply ? randomUUID() : null, actor,
        environment: request.environment, database: { host: target.hostname, port: target.port, name: target.database },
        accountId: account.id, username: account.username, reason: request.reason,
        oldStartingElo: account.initial_rating, newStartingElo: newElo,
        oldStartingRating: formatDupr(account.initial_rating), newStartingRating: formatDupr(newElo),
        processedMatches: replay.processedMatchIds.length,
        changes: [...changesByEntity.values()],
      };
      if (request.apply) {
        await tx`update public.player_accounts set initial_rating = ${newElo} where id = ${account.id}`;
        await tx`update public.players set initial_rating = ${newElo} where account_id = ${account.id}`;
        await repository.replaceRatingState("", replay.players, replay.snapshots);
        // Accounts without roster memberships are absent from normal replay inputs.
        await tx`update public.player_accounts set rating = ${targetState?.rating ?? newElo},
          rated_games_played = ${targetState?.ratedGamesPlayed ?? 0} where id = ${account.id}`;
        await tx`insert into public.rating_correction_audit
          (id, environment, account_id, username, old_starting_elo, new_starting_elo, reason, report)
          values (${report.correctionId!}, ${request.environment}, ${account.id}, ${account.username},
            ${account.initial_rating}, ${newElo}, ${request.reason}, ${tx.json(report)})`;
      }
      return report;
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "55P03") throw new MaintenanceError("Rating history is busy with another transaction. Nothing was applied; try again when scoring is idle.");
    if (code === "42501") throw new MaintenanceError("Maintenance login is not authorized for this operation.");
    throw error;
  }
}
