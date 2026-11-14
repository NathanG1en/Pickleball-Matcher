import type postgres from "postgres";

import type { DomainRepository } from "@/lib/domain/repositories";
import { parseGroupOrganizerPermissions } from "@/lib/auth/group-permissions";
import { parseProfileVisibilitySettings } from "@/lib/privacy/profile-visibility";
import {
  type AttendanceRecord,
  type PartnerRequestRecord,
  type GroupRecord,
  type GroupOrganizerPermissions,
  type GroupOrganizerRecord,
  DEFAULT_GROUP_ORGANIZER_PERMISSIONS,
  MatchPlayerRecord,
  MatchRecord,
  MatchResultContext,
  PlayerRecord,
  PlayerAccountRecord,
  PlayerGender,
  ProfileVisibilitySettings,
  PlayerSessionHistoryRecord,
  PlayerSynergyRecord,
  PairMatchSynergyResult,
  PublicGroupRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundCompletionContext,
  RoundSitRecord,
  SessionRecord,
  SessionType,
  StartedRoundRecord,
  TournamentRecord,
  TournamentDivision,
  TournamentBracket,
  TournamentFormat,
  TeamTournamentData,
} from "@/lib/domain/types";
import type { ScoreBreakdown } from "@/lib/matchmaking/types";
import { updateSynergyState } from "@/lib/synergy/calculator";
import { replayRatings } from "@/lib/domain/rating-replay";

export class RepositoryConflictError extends Error {
  constructor(message = "The record changed before this update was saved.") {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

type PartnerRequestRow = {
  id: string; session_id: string; requester_player_id: string; partner_player_id: string;
  status: PartnerRequestRecord["status"]; created_at: Date; resolved_at: Date | null; version: number;
};
const mapPartnerRequest = (row: PartnerRequestRow): PartnerRequestRecord => ({
  id: row.id, sessionId: row.session_id, requesterPlayerId: row.requester_player_id,
  partnerPlayerId: row.partner_player_id, status: row.status, createdAt: row.created_at, resolvedAt: row.resolved_at, version: row.version,
});

type GroupRow = {
  id: string;
  name: string;
  organizer_pin_hash: string;
  created_at: Date;
  is_public: boolean;
  owner_account_id: string | null;
  organizer_permissions?: unknown;
};

type SessionRow = {
  id: string;
  group_id: string;
  court_count: number;
  court_player_counts: number[] | null;
  stay_together_pairs?: [string, string][];
  status: "active" | "completed";
  current_round_number: number;
  started_at: Date;
  ended_at: Date | null;
  version: number;
  type?: "regular" | "open_play" | null;
  name?: string | null;
};

type PlayerRow = {
  id: string;
  group_id: string;
  name: string;
  gender?: "male" | "female" | null;
  initial_rating: number;
  rating: number;
  rated_games_played: number;
  active: boolean;
  account_id: string | null;
  username?: string | null;
  is_public?: boolean | null;
  visibility_settings?: unknown;
};

type PlayerAccountRow = {
  id: string;
  username: string;
  name: string;
  gender?: "male" | "female" | null;
  is_public?: boolean;
  visibility_settings?: unknown;
  password_hash: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  initial_rating: number;
  rating?: number;
  rated_games_played?: number;
  created_at: Date;
};

type PlayerSynergyRow = {
  account_id_1: string;
  account_id_2: string;
  matches_played: number;
  wins: number;
  synergy_score: number;
  weight_sum?: number | null;
  contribution_sum?: number | null;
  weight_sq_sum?: number | null;
  updated_at: Date;
};

type AttendanceRow = {
  session_id: string;
  player_id: string;
  joined_round: number;
  left_round: number | null;
};

type RoundRow = {
  id: string;
  session_id: string;
  round_number: number;
  status: "started" | "completed" | "cancelled";
  seed: string | number;
  score_breakdown: ScoreBreakdown;
  created_at: Date;
  started_at: Date;
  completed_at: Date | null;
  version: number;
};

type MatchRow = {
  id: string;
  round_id: string;
  court_number: number;
  status: "pending" | "completed" | "cancelled";
  team1_score: number | null;
  team2_score: number | null;
  completed_at: Date | null;
  version: number;
  rated: boolean;
};

type MatchPlayerRow = {
  match_id: string;
  player_id: string;
  team: 1 | 2;
  rating_before: number | null;
  rating_after: number | null;
};

type SitRow = { round_id: string; player_id: string };

type TournamentRow = {
  id: string;
  group_id: string;
  name: string;
  status: "draft" | "active" | "completed";
  divisions: TournamentDivision[] | string;
  brackets: Record<string, TournamentBracket> | string;
  created_at: Date;
  updated_at: Date;
  format?: TournamentFormat | null;
  team_data?: TeamTournamentData | string | null;
};

function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return defaultValue;
}

const mapTournament = (row: TournamentRow): TournamentRecord => {
  const divisions = parseJsonField<TournamentDivision[]>(row.divisions, []);
  const brackets = parseJsonField<Record<string, TournamentBracket>>(row.brackets, {});
  const teamData = parseJsonField<TeamTournamentData | null>(row.team_data, null);
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    status: row.status,
    divisions: Array.isArray(divisions) ? divisions : [],
    brackets: typeof brackets === "object" && brackets !== null ? brackets : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    format: row.format ?? "bracket",
    teamData: teamData && typeof teamData === "object" ? teamData : null,
  };
};

const mapGroup = (row: GroupRow): GroupRecord => ({
  id: row.id,
  name: row.name,
  organizerPinHash: row.organizer_pin_hash,
  createdAt: row.created_at,
  isPublic: row.is_public,
  ownerAccountId: row.owner_account_id,
  organizerPermissions: parseGroupOrganizerPermissions(row.organizer_permissions),
});

const mapSession = (row: SessionRow): SessionRecord => ({
  id: row.id,
  groupId: row.group_id,
  courtCount: row.court_count,
  stayTogetherPairs: row.stay_together_pairs ?? [],
  courtPlayerCounts: row.court_player_counts?.length ? row.court_player_counts as (2 | 3 | 4)[] : undefined,
  status: row.status,
  currentRoundNumber: row.current_round_number,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  version: row.version,
  type: (row.type as SessionType) ?? "regular",
  name: row.name ?? null,
});

const mapPlayer = (row: PlayerRow): PlayerRecord => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  initialRating: row.initial_rating,
  rating: row.rating,
  ratedGamesPlayed: row.rated_games_played,
  active: row.active,
  accountId: row.account_id,
  username: row.username ?? null,
  gender: row.gender ?? null,
  isPublic: row.is_public ?? true,
  visibilitySettings: row.visibility_settings
    ? parseProfileVisibilitySettings(row.visibility_settings, row.is_public ?? true)
    : undefined,
});

const mapPlayerAccount = (row: PlayerAccountRow): PlayerAccountRecord => ({
  id: row.id,
  username: row.username,
  name: row.name,
  gender: (row.gender as PlayerGender) ?? undefined,
  isPublic: row.is_public ?? true,
  visibilitySettings: parseProfileVisibilitySettings(row.visibility_settings, row.is_public ?? true),
  passwordHash: row.password_hash,
  skillLevel: row.skill_level,
  initialRating: row.initial_rating,
  rating: row.rating ?? row.initial_rating,
  ratedGamesPlayed: row.rated_games_played ?? 0,
  createdAt: row.created_at,
});

const mapPlayerSynergy = (row: PlayerSynergyRow): PlayerSynergyRecord => ({
  accountId1: row.account_id_1,
  accountId2: row.account_id_2,
  matchesPlayed: row.matches_played,
  wins: row.wins,
  synergyScore: row.synergy_score,
  weightSum: row.weight_sum ?? undefined,
  contributionSum: row.contribution_sum ?? undefined,
  weightSqSum: row.weight_sq_sum ?? undefined,
  updatedAt: row.updated_at,
});

const mapAttendance = (row: AttendanceRow): AttendanceRecord => ({
  sessionId: row.session_id,
  playerId: row.player_id,
  joinedRound: row.joined_round,
  leftRound: row.left_round,
});

const mapRound = (row: RoundRow): RoundRecord => ({
  id: row.id,
  sessionId: row.session_id,
  roundNumber: row.round_number,
  status: row.status,
  seed: Number(row.seed),
  scoreBreakdown: row.score_breakdown,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  version: row.version,
});

const mapMatch = (row: MatchRow): MatchRecord => ({
  id: row.id,
  roundId: row.round_id,
  courtNumber: row.court_number,
  status: row.status,
  team1Score: row.team1_score,
  team2Score: row.team2_score,
  completedAt: row.completed_at,
  version: row.version,
  rated: row.rated,
});

const mapMatchPlayer = (row: MatchPlayerRow): MatchPlayerRecord => ({
  matchId: row.match_id,
  playerId: row.player_id,
  team: row.team,
  ratingBefore: row.rating_before,
  ratingAfter: row.rating_after,
});

const mapSit = (row: SitRow): RoundSitRecord => ({
  roundId: row.round_id,
  playerId: row.player_id,
});

export class PostgresRepositories implements DomainRepository {
  private readonly query: postgres.Sql;
  private readonly inTransaction: boolean;

  constructor(
    private readonly database: postgres.Sql,
    transaction?: postgres.TransactionSql,
  ) {
    this.query = (transaction ?? database) as unknown as postgres.Sql;
    this.inTransaction = Boolean(transaction);
  }

  async transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T> {
    return (await this.database.begin((transaction) =>
      operation(new PostgresRepositories(this.database, transaction)),
    )) as unknown as T;
  }

  async getGroup(groupId: string): Promise<GroupRecord | null> {
    const rows = await this.query<GroupRow[]>`
      select id, name, organizer_pin_hash, created_at, is_public, owner_account_id, organizer_permissions
      from groups where id = ${groupId}
    `;
    return rows[0] ? mapGroup(rows[0]) : null;
  }

  async getGroupsByName(name: string): Promise<readonly GroupRecord[]> {
    const rows = await this.query<GroupRow[]>`
      select id, name, organizer_pin_hash, created_at, is_public, owner_account_id, organizer_permissions
      from groups where name = ${name.trim()}
    `;
    return rows.map(mapGroup);
  }

  async listPublicGroups(search: string, accountId?: string): Promise<readonly PublicGroupRecord[]> {
    const term = search.trim();
    const rows = await this.query<{
      id: string;
      name: string;
      player_count: number;
      is_member: boolean;
      is_host: boolean;
      is_organizer: boolean;
    }[]>`
      select g.id, g.name, count(distinct p.id)::int as player_count,
        coalesce(bool_or(mine.id is not null), false) as is_member,
        coalesce(g.owner_account_id = ${accountId ?? ""}, false) as is_host,
        (coalesce(g.owner_account_id = ${accountId ?? ""}, false) or coalesce(bool_or(org.account_id is not null), false)) as is_organizer
      from groups g
      left join players p on p.group_id = g.id and p.active = true
      left join players mine on mine.group_id = g.id and mine.account_id = ${accountId ?? ""} and mine.active = true
      left join group_organizers org on org.group_id = g.id and org.account_id = ${accountId ?? ""}
      where g.is_public = true
        and (${term} = '' or strpos(lower(g.name), lower(${term})) > 0)
      group by g.id, g.name, g.owner_account_id
      order by g.name
      limit 50
    `;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      playerCount: row.player_count,
      isMember: row.is_member,
      isHost: row.is_host,
      isOrganizer: row.is_organizer,
    }));
  }

  async listAccountGroups(accountId: string): Promise<readonly PublicGroupRecord[]> {
    const rows = await this.query<{
      id: string; name: string; player_count: number; is_member: boolean; is_host: boolean; is_organizer: boolean;
    }[]>`
      select g.id, g.name, count(distinct roster.id)::int as player_count,
        coalesce(bool_or(mine.id is not null), false) as is_member,
        coalesce(g.owner_account_id = ${accountId}, false) as is_host,
        (coalesce(g.owner_account_id = ${accountId}, false) or coalesce(bool_or(org.account_id is not null), false)) as is_organizer
      from groups g
      left join players roster on roster.group_id = g.id and roster.active = true
      left join players mine on mine.group_id = g.id and mine.account_id = ${accountId} and mine.active = true
      left join group_organizers org on org.group_id = g.id and org.account_id = ${accountId}
      where g.owner_account_id = ${accountId} or org.account_id = ${accountId} or mine.id is not null
      group by g.id, g.name, g.owner_account_id
      order by g.name
    `;
    return rows.map((row) => ({
      id: row.id, name: row.name, playerCount: row.player_count,
      isMember: row.is_member, isHost: row.is_host, isOrganizer: row.is_organizer,
    }));
  }

  async isGroupOrganizer(groupId: string, accountId: string): Promise<boolean> {
    const rows = await this.query<{ allowed: boolean }[]>`
      select exists (
        select 1 from groups where id = ${groupId} and owner_account_id = ${accountId}
        union all
        select 1 from group_organizers where group_id = ${groupId} and account_id = ${accountId}
      ) as allowed
    `;
    return rows[0]?.allowed === true;
  }

  async addGroupOrganizer(groupId: string, accountId: string): Promise<void> {
    await this.query`
      insert into group_organizers (group_id, account_id)
      select ${groupId}, ${accountId}
      where exists (select 1 from groups where id = ${groupId})
        and exists (select 1 from player_accounts where id = ${accountId})
      on conflict (group_id, account_id) do nothing
    `;
  }

  async removeGroupOrganizer(groupId: string, accountId: string): Promise<void> {
    await this.query`
      delete from group_organizers
      where group_id = ${groupId} and account_id = ${accountId}
    `;
  }

  async listGroupOrganizers(groupId: string): Promise<readonly GroupOrganizerRecord[]> {
    const rows = await this.query<{ account_id: string; username: string; name: string; is_host: boolean }[]>`
      select p.id as account_id, p.username, p.name, true as is_host
      from groups g join player_accounts p on p.id = g.owner_account_id
      where g.id = ${groupId}
      union all
      select p.id as account_id, p.username, p.name, false as is_host
      from group_organizers o join player_accounts p on p.id = o.account_id
      where o.group_id = ${groupId}
      order by is_host desc, name
    `;
    return rows.map((row) => ({ accountId: row.account_id, username: row.username, name: row.name, isHost: row.is_host }));
  }

  async transferGroupHost(groupId: string, newHostAccountId: string): Promise<void> {
    const current = await this.getGroup(groupId);
    if (!current) return;
    const oldHostAccountId = current.ownerAccountId;

    await this.query`update groups set owner_account_id = ${newHostAccountId} where id = ${groupId}`;
    await this.query`delete from group_organizers where group_id = ${groupId} and account_id = ${newHostAccountId}`;
    if (oldHostAccountId) {
      await this.query`
        insert into group_organizers (group_id, account_id)
        select ${groupId}, ${oldHostAccountId}
        where exists (select 1 from groups where id = ${groupId})
          and exists (select 1 from player_accounts where id = ${oldHostAccountId})
        on conflict (group_id, account_id) do nothing
      `;
    }
  }

  async getPlayerAccount(accountId: string): Promise<PlayerAccountRecord | null> {
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, gender, is_public, visibility_settings, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts where id = ${accountId}
    `;
    return rows[0] ? mapPlayerAccount(rows[0]) : null;
  }

  async getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null> {
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, gender, is_public, visibility_settings, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts where username = ${username.trim().toLowerCase()}
    `;
    return rows[0] ? mapPlayerAccount(rows[0]) : null;
  }

  async createPlayerAccount(account: PlayerAccountRecord): Promise<void> {
    const visibilityJson = account.visibilitySettings ? JSON.stringify(account.visibilitySettings) : null;
    await this.query`
      insert into player_accounts (id, username, name, gender, is_public, visibility_settings, initial_rating, rating, rated_games_played, password_hash, skill_level, created_at)
      values (${account.id}, ${account.username.trim().toLowerCase()}, ${account.name}, ${account.gender ?? null}, ${account.isPublic ?? true}, ${visibilityJson}::jsonb, ${account.initialRating}, ${account.initialRating}, 0, ${account.passwordHash}, ${account.skillLevel}, ${account.createdAt})
    `;
  }

  async updatePlayerAccountName(accountId: string, name: string): Promise<void> {
    await this.query.begin(async (transaction) => {
      const transactionQuery = transaction as unknown as postgres.Sql;
      await transactionQuery`update player_accounts set name = ${name} where id = ${accountId}`;
      await transactionQuery`update players set name = ${name} where account_id = ${accountId}`;
    });
  }

  async updatePlayerAccountUsername(accountId: string, username: string): Promise<void> {
    await this.query`
      update player_accounts set username = ${username.trim().toLowerCase()}
      where id = ${accountId}
    `;
  }

  async updatePlayerAccountGender(accountId: string, gender: "male" | "female"): Promise<void> {
    await this.query.begin(async (transaction) => {
      const transactionQuery = transaction as unknown as postgres.Sql;
      await transactionQuery`update player_accounts set gender = ${gender} where id = ${accountId}`;
      await transactionQuery`update players set gender = ${gender} where account_id = ${accountId}`;
    });
  }

  async updatePlayerPrivacy(accountId: string, isPublic: boolean, visibilitySettings?: ProfileVisibilitySettings): Promise<void> {
    if (visibilitySettings) {
      await this.query`
        update player_accounts
        set is_public = ${isPublic},
            visibility_settings = ${JSON.stringify(visibilitySettings)}::jsonb
        where id = ${accountId}
      `;
    } else {
      await this.query`
        update player_accounts set is_public = ${isPublic}
        where id = ${accountId}
      `;
    }
  }

  async listPairSynergies(accountIds: readonly string[]): Promise<readonly PlayerSynergyRecord[]> {
    if (accountIds.length < 2) return [];
    const rows = await this.query<PlayerSynergyRow[]>`
      select account_id_1, account_id_2, matches_played, wins, synergy_score, weight_sum, contribution_sum, weight_sq_sum, updated_at
      from player_synergy
      where account_id_1 = any(${[...accountIds]}::text[])
        and account_id_2 = any(${[...accountIds]}::text[])
    `;
    return rows.map(mapPlayerSynergy);
  }

  async getPairSynergy(accountIdA: string, accountIdB: string): Promise<PlayerSynergyRecord | null> {
    if (accountIdA === accountIdB) return null;
    const [first, second] = accountIdA < accountIdB ? [accountIdA, accountIdB] : [accountIdB, accountIdA];
    const rows = await this.query<PlayerSynergyRow[]>`
      select account_id_1, account_id_2, matches_played, wins, synergy_score, weight_sum, contribution_sum, weight_sq_sum, updated_at
      from player_synergy
      where account_id_1 = ${first} and account_id_2 = ${second}
    `;
    return rows[0] ? mapPlayerSynergy(rows[0]) : null;
  }

  async getBestPartner(accountId: string): Promise<{ partnerAccountId: string; username: string; synergyScore: number; matchesPlayed: number } | null> {
    const rows = await this.query<{ partner_account_id: string; username: string; synergy_score: number; matches_played: number }[]>`
      select
        case when s.account_id_1 = ${accountId} then s.account_id_2 else s.account_id_1 end as partner_account_id,
        p.username,
        s.synergy_score,
        s.matches_played
      from player_synergy s
      join player_accounts p on p.id = (case when s.account_id_1 = ${accountId} then s.account_id_2 else s.account_id_1 end)
      where (s.account_id_1 = ${accountId} or s.account_id_2 = ${accountId})
        and s.matches_played >= 1
      order by s.synergy_score desc, s.matches_played desc
      limit 1
    `;
    if (!rows[0]) return null;
    return {
      partnerAccountId: rows[0].partner_account_id,
      username: rows[0].username,
      synergyScore: rows[0].synergy_score,
      matchesPlayed: rows[0].matches_played,
    };
  }

  async lockSynergyState(): Promise<void> {
    if (!this.inTransaction) throw new Error("Chemistry replay requires a transaction.");
    await this.query`select pg_advisory_xact_lock(hashtextextended('pickleball:synergy-state', 0))`;
  }

  async replaceSynergyState(records: readonly PlayerSynergyRecord[]): Promise<void> {
    if (!this.inTransaction) throw new Error("Chemistry replacement requires a transaction.");
    // Consume the DELETE output before inserting replacement rows. Empty input
    // still clears the table; the caller keeps the same lock and transaction.
    await this.query`
      with cleared as (delete from player_synergy returning 1)
      insert into player_synergy (account_id_1, account_id_2, matches_played, wins, synergy_score,
        weight_sum, contribution_sum, weight_sq_sum, updated_at)
      select * from unnest(
        ${records.map(r => r.accountId1)}::text[], ${records.map(r => r.accountId2)}::text[],
        ${records.map(r => r.matchesPlayed)}::int[], ${records.map(r => r.wins)}::int[],
        ${records.map(r => r.synergyScore)}::float8[], ${records.map(r => r.weightSum ?? 0)}::float8[],
        ${records.map(r => r.contributionSum ?? 0)}::float8[], ${records.map(r => r.weightSqSum ?? 0)}::float8[],
        ${records.map(r => r.updatedAt.toISOString())}::timestamptz[])
      where (select count(*) from cleared) >= 0
    `;
  }

  async recordMatchesSynergy(pairResults: readonly PairMatchSynergyResult[]): Promise<void> {
    if (pairResults.length === 0) return;
    if (!this.inTransaction) {
      await this.transaction(repository => repository.recordMatchesSynergy(pairResults));
      return;
    }
    await this.lockSynergyState();
    for (const pair of pairResults) {
      if (pair.accountIdA === pair.accountIdB) continue;
      const [first, second] = pair.accountIdA < pair.accountIdB
        ? [pair.accountIdA, pair.accountIdB]
        : [pair.accountIdB, pair.accountIdA];

      const existing = await this.getPairSynergy(first, second);
      const updated = updateSynergyState(
        existing
          ? {
              matchesPlayed: existing.matchesPlayed,
              wins: existing.wins,
              weightSum: existing.weightSum,
              contributionSum: existing.contributionSum,
              weightSqSum: existing.weightSqSum,
            }
          : null,
        {
          won: pair.won,
          expectedWinProbability: pair.expectedWinProbability,
          ownScore: pair.ownScore,
          opponentScore: pair.opponentScore,
        }
      );

      await this.query`
        insert into player_synergy (
          account_id_1, account_id_2, matches_played, wins, synergy_score,
          weight_sum, contribution_sum, weight_sq_sum, updated_at
        )
        values (
          ${first},
          ${second},
          ${updated.matchesPlayed},
          ${updated.wins},
          ${updated.synergyScore},
          ${updated.weightSum},
          ${updated.contributionSum},
          ${updated.weightSqSum},
          now()
        )
        on conflict (account_id_1, account_id_2) do update set
          matches_played = excluded.matches_played,
          wins = excluded.wins,
          synergy_score = excluded.synergy_score,
          weight_sum = excluded.weight_sum,
          contribution_sum = excluded.contribution_sum,
          weight_sq_sum = excluded.weight_sq_sum,
          updated_at = now()
      `;
    }
  }

  async searchPlayerAccounts(query: string, limit: number = 10): Promise<readonly PlayerAccountRecord[]> {
    const trimmed = query.trim().toLowerCase().replace(/^@/, "");
    if (!trimmed) return [];
    const searchTerm = `%${trimmed}%`;
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, gender, is_public, visibility_settings, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts
      where (username ilike ${searchTerm} or name ilike ${searchTerm})
      order by (username = ${trimmed}) desc, username asc
      limit ${limit}
    `;
    return rows.map(mapPlayerAccount);
  }

  async listPlayerAccounts(search: string = "", limit: number = 50): Promise<readonly PlayerAccountRecord[]> {
    const trimmed = search.trim().toLowerCase().replace(/^@/, "");
    const searchTerm = `%${trimmed}%`;
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, gender, is_public, visibility_settings, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts
      where (${trimmed} = '' or username ilike ${searchTerm} or name ilike ${searchTerm})
      order by (${trimmed} != '' and username = ${trimmed}) desc, name asc, username asc
      limit ${limit}
    `;
    return rows.map(mapPlayerAccount);
  }

  async addPlayerToGroup(accountId: string, groupId: string): Promise<PlayerRecord | null> {
    await this.query`
      insert into players (id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id)
      select 'ply_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
             g.id, a.name, a.gender, a.initial_rating, a.rating, a.rated_games_played, true, a.id
      from groups g cross join player_accounts a
      where g.id = ${groupId} and a.id = ${accountId}
      on conflict (group_id, account_id) where account_id is not null do update set active = true, rating = excluded.rating, rated_games_played = excluded.rated_games_played
    `;

    const existing = await this.query<PlayerRow[]>`
      select p.id, p.group_id, coalesce(a.name, p.name) as name, coalesce(p.gender, a.gender) as gender, p.initial_rating,
             coalesce(a.rating, p.rating) as rating,
             coalesce(a.rated_games_played, p.rated_games_played) as rated_games_played,
             p.active, p.account_id, a.username,
             a.is_public as is_public,
             a.visibility_settings as visibility_settings
      from players p
      left join player_accounts a on a.id = p.account_id
      where p.account_id = ${accountId} and p.group_id = ${groupId}
    `;
    return existing[0] ? mapPlayer(existing[0]) : null;
  }

  async linkGuestPlayer(groupId: string, playerId: string, accountId: string): Promise<PlayerRecord | null> {
    return (await this.transaction(async (tx) => {
      const txRepo = tx as PostgresRepositories;
      // Keep the baseline stable through linking/replay, including maintenance corrections.
      const accountRows = await txRepo.query<PlayerAccountRow[]>`
        select id, username, name, gender, is_public, visibility_settings, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
        from player_accounts
        where id = ${accountId}
        for update
      `;
      if (!accountRows[0]) return null;
      const account = mapPlayerAccount(accountRows[0]);

      const guestRows = await txRepo.query<PlayerRow[]>`
        select id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
        from players
        where id = ${playerId} and group_id = ${groupId}
      `;
      if (!guestRows[0] || guestRows[0].account_id !== null) {
        return null;
      }

      const existingInGroup = await txRepo.query<PlayerRow[]>`
        select id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
        from players
        where group_id = ${groupId} and account_id = ${accountId}
      `;

      if (existingInGroup.length > 0) {
        const targetPlayerId = existingInGroup[0].id;

        // Merge session_attendance
        const sAttendances = await txRepo.query<AttendanceRow[]>`
          select session_id, player_id, joined_round, left_round
          from session_attendance
          where player_id = ${playerId}
        `;
        for (const sa of sAttendances) {
          const targetAtt = await txRepo.query<AttendanceRow[]>`
            select session_id, player_id, joined_round, left_round
            from session_attendance
            where session_id = ${sa.session_id} and player_id = ${targetPlayerId}
          `;
          if (targetAtt[0]) {
            const minJoined = Math.min(targetAtt[0].joined_round, sa.joined_round);
            const mergedLeft =
              targetAtt[0].left_round === null || sa.left_round === null
                ? null
                : Math.max(targetAtt[0].left_round, sa.left_round);
            await txRepo.query`
              update session_attendance
              set joined_round = ${minJoined}, left_round = ${mergedLeft}
              where session_id = ${sa.session_id} and player_id = ${targetPlayerId}
            `;
            await txRepo.query`
              delete from session_attendance
              where session_id = ${sa.session_id} and player_id = ${playerId}
            `;
          } else {
            await txRepo.query`
              update session_attendance
              set player_id = ${targetPlayerId}
              where session_id = ${sa.session_id} and player_id = ${playerId}
            `;
          }
        }

        // Merge match_players
        const sMatches = await txRepo.query<MatchPlayerRow[]>`
          select match_id, player_id, team, rating_before, rating_after
          from match_players
          where player_id = ${playerId}
        `;
        for (const sm of sMatches) {
          const targetMp = await txRepo.query<MatchPlayerRow[]>`
            select match_id, player_id
            from match_players
            where match_id = ${sm.match_id} and player_id = ${targetPlayerId}
          `;
          if (targetMp[0]) {
            await txRepo.query`
              delete from match_players
              where match_id = ${sm.match_id} and player_id = ${playerId}
            `;
          } else {
            await txRepo.query`
              update match_players
              set player_id = ${targetPlayerId}
              where match_id = ${sm.match_id} and player_id = ${playerId}
            `;
          }
        }

        // Merge round_sits
        const sSits = await txRepo.query<SitRow[]>`
          select round_id, player_id
          from round_sits
          where player_id = ${playerId}
        `;
        for (const ss of sSits) {
          const targetSit = await txRepo.query<SitRow[]>`
            select round_id, player_id
            from round_sits
            where round_id = ${ss.round_id} and player_id = ${targetPlayerId}
          `;
          if (targetSit[0]) {
            await txRepo.query`
              delete from round_sits
              where round_id = ${ss.round_id} and player_id = ${playerId}
            `;
          } else {
            await txRepo.query`
              update round_sits
              set player_id = ${targetPlayerId}
              where round_id = ${ss.round_id} and player_id = ${playerId}
            `;
          }
        }

        // Delete guest player
        await txRepo.query`
          delete from players
          where id = ${playerId} and group_id = ${groupId} and account_id is null
        `;

        // Update target player record
        await txRepo.query`
          update players
          set active = true,
              gender = coalesce(players.gender, ${guestRows[0].gender ?? null}, ${account.gender ?? null}),
              name = ${account.name}
          where id = ${targetPlayerId} and group_id = ${groupId}
        `;

        await replayRatings(groupId, txRepo);

        const finalRows = await txRepo.query<PlayerRow[]>`
          select id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
          from players
          where id = ${targetPlayerId} and group_id = ${groupId}
        `;
        if (!finalRows[0]) return null;

        return {
          ...mapPlayer(finalRows[0]),
          username: account.username,
        };
      }

      const updatedRows = await txRepo.query<PlayerRow[]>`
        update players
        set account_id = ${accountId},
            name = ${account.name},
            gender = coalesce(players.gender, ${account.gender ?? null}),
            initial_rating = ${account.initialRating},
            rating = coalesce(${account.rating ?? null}, initial_rating),
            rated_games_played = ${account.ratedGamesPlayed ?? 0},
            active = true
        where id = ${playerId} and group_id = ${groupId} and account_id is null
        returning id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
      `;
      if (!updatedRows[0]) return null;

      await replayRatings(groupId, txRepo);

      return {
        ...mapPlayer(updatedRows[0]),
        username: account.username,
        isPublic: account.isPublic,
        visibilitySettings: account.visibilitySettings,
      };
    })) ?? null;
  }


  async joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null> {
    await this.query`
      insert into players (id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id)
      select 'ply_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
             g.id, a.name, a.gender, a.initial_rating, a.rating, a.rated_games_played, true, a.id
      from groups g cross join player_accounts a
      where g.id = ${groupId} and (g.is_public = true or g.owner_account_id = ${accountId}) and a.id = ${accountId}
      on conflict (group_id, account_id) where account_id is not null do update set active = true, rating = excluded.rating, rated_games_played = excluded.rated_games_played
    `;

    const existing = await this.query<PlayerRow[]>`
      select p.id, p.group_id, coalesce(a.name, p.name) as name, coalesce(p.gender, a.gender) as gender, p.initial_rating,
             coalesce(a.rating, p.rating) as rating,
             coalesce(a.rated_games_played, p.rated_games_played) as rated_games_played,
             p.active, p.account_id, a.username,
             a.is_public as is_public,
             a.visibility_settings as visibility_settings
      from players p
      left join player_accounts a on a.id = p.account_id
      where p.account_id = ${accountId} and p.group_id = ${groupId}
    `;
    return existing[0] ? mapPlayer(existing[0]) : null;
  }

  async leavePublicGroup(accountId: string, groupId: string): Promise<boolean> {
    await this.query`
      delete from group_organizers
      where group_id = ${groupId} and account_id = ${accountId}
    `;
    const rows = await this.query<{ id: string }[]>`
      update players set active = false
      where group_id = ${groupId}
        and account_id = ${accountId}
        and active = true
        and not exists (
          select 1 from groups where id = ${groupId} and owner_account_id = ${accountId}
        )
      returning id
    `;
    return rows.length > 0;
  }

  async updateGroupVisibility(groupId: string, isPublic: boolean): Promise<void> {
    await this.query`update groups set is_public = ${isPublic} where id = ${groupId}`;
  }

  async updateGroupName(groupId: string, name: string): Promise<void> {
    await this.query`update groups set name = ${name} where id = ${groupId}`;
  }

  async updateGroupOrganizerPermissions(groupId: string, permissions: GroupOrganizerPermissions): Promise<void> {
    await this.query`update groups set organizer_permissions = ${JSON.stringify(permissions)}::jsonb where id = ${groupId}`;
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.query`delete from groups where id = ${groupId}`;
  }

  async listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]> {
    const rows = await this.query<{
      session_id: string;
      group_id: string;
      group_name: string;
      started_at: Date;
      wins: number;
      losses: number;
      rating: number;
      type?: string | null;
      session_name?: string | null;
    }[]>`
      with memberships as (
        select p.id, p.group_id, coalesce(a.initial_rating, p.initial_rating) as initial_rating
        from players p left join player_accounts a on a.id = p.account_id
        where p.account_id = ${accountId}
      ), results as (
        select mp.player_id, s.id as session_id,
          count(*) filter (where
            (mp.team = 1 and m.team1_score > m.team2_score) or
            (mp.team = 2 and m.team2_score > m.team1_score)
          )::int as wins,
          count(*) filter (where
            (mp.team = 1 and m.team1_score < m.team2_score) or
            (mp.team = 2 and m.team2_score < m.team1_score)
          )::int as losses,
          (array_agg(mp.rating_after order by m.completed_at desc, m.id desc)
            filter (where mp.rating_after is not null and m.rated = true))[1] as rating
        from memberships p
        join match_players mp on mp.player_id = p.id
        join matches m on m.id = mp.match_id and m.status = 'completed'
        join rounds r on r.id = m.round_id
        join sessions s on s.id = r.session_id
        group by mp.player_id, s.id
      ), player_sessions as (
        select sa.player_id, sa.session_id
        from session_attendance sa
        union
        select mp.player_id, r.session_id
        from match_players mp
        join matches m on m.id = mp.match_id
        join rounds r on r.id = m.round_id
      )
      select s.id as session_id, g.id as group_id, g.name as group_name,
        s.started_at, coalesce(res.wins, 0)::int as wins,
        coalesce(res.losses, 0)::int as losses,
        coalesce(res.rating, prior.rating, membership.initial_rating)::float8 as rating,
        s.type as type,
        s.name as session_name
      from memberships membership
      join groups g on g.id = membership.group_id
      join player_sessions ps on ps.player_id = membership.id
      join sessions s on s.id = ps.session_id
      left join results res on res.player_id = membership.id and res.session_id = s.id
      left join lateral (
        select mp.rating_after as rating
        from players history_player
        join match_players mp on mp.player_id = history_player.id
        join matches m on m.id = mp.match_id
        where history_player.account_id = ${accountId}
          and m.status = 'completed' and m.rated = true
          and mp.rating_after is not null and m.completed_at <= s.started_at
        order by m.completed_at desc, m.id desc
        limit 1
      ) prior on res.rating is null
      order by s.started_at desc, g.name
    `;
    return rows.map((row) => ({
      sessionId: row.session_id,
      groupId: row.group_id,
      groupName: row.group_name,
      startedAt: row.started_at,
      wins: row.wins,
      losses: row.losses,
      rating: row.rating,
      type: (row.type as SessionType) ?? "regular",
      sessionName: row.session_name ?? null,
    }));
  }

  async insertGroup(group: GroupRecord): Promise<void> {
    const permissions = JSON.stringify(group.organizerPermissions ?? DEFAULT_GROUP_ORGANIZER_PERMISSIONS);
    await this.query`
      insert into groups (id, name, organizer_pin_hash, created_at, is_public, owner_account_id, organizer_permissions)
      values (${group.id}, ${group.name}, ${group.organizerPinHash}, ${group.createdAt}, ${group.isPublic ?? false}, ${group.ownerAccountId ?? null}, ${permissions}::jsonb)
    `;
  }

  async listSessions(groupId: string): Promise<readonly SessionRecord[]> {
    const rows = await this.query<SessionRow[]>`
      select id, group_id, court_count, court_player_counts, stay_together_pairs, status, current_round_number,
             started_at, ended_at, version, type, name
      from sessions where group_id = ${groupId}
      order by started_at desc
    `;
    return rows.map(mapSession);
  }

  async createPlayer(player: PlayerRecord): Promise<void> {
    await this.query`
      insert into players (id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id)
      values (${player.id}, ${player.groupId}, ${player.name}, ${player.gender ?? null}, ${player.initialRating}, ${player.rating}, ${player.ratedGamesPlayed}, ${player.active}, ${player.accountId ?? null})
    `;
  }

  async updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }): Promise<void> {
    if (player.name !== undefined) {
      await this.query`
        update players set name = ${player.name}
        where id = ${player.id} and group_id = ${player.groupId}
      `;
    }
    if (player.gender !== undefined) {
      await this.query`
        update players set gender = ${player.gender ?? null}
        where id = ${player.id} and group_id = ${player.groupId}
      `;
    }
    if (player.active !== undefined) {
      await this.query`
        update players set active = ${player.active}
        where id = ${player.id} and group_id = ${player.groupId}
      `;
    }
    if (player.initialRating !== undefined) {
      await this.query`
        update players set initial_rating = ${player.initialRating}
        where id = ${player.id} and group_id = ${player.groupId}
      `;
      const accountRows = await this.query<{ account_id: string | null }[]>`
        select account_id from players where id = ${player.id} and group_id = ${player.groupId}
      `;
      const accountId = accountRows[0]?.account_id;
      if (accountId) {
        await this.query`
          update player_accounts set initial_rating = ${player.initialRating}
          where id = ${accountId}
        `;
        await this.query`
          update players set initial_rating = ${player.initialRating}
          where account_id = ${accountId}
        `;
      }
    }
  }

  async removePlayerFromGroup(playerId: string, groupId: string): Promise<boolean> {
    const playerRows = await this.query<{ account_id: string | null; rated_games_played: number }[]>`
      select account_id, rated_games_played from players where id = ${playerId} and group_id = ${groupId}
    `;
    if (!playerRows[0]) return false;
    const accountId = playerRows[0].account_id;

    if (accountId) {
      const isOwner = await this.query<{ is_owner: boolean }[]>`
        select exists (select 1 from groups where id = ${groupId} and owner_account_id = ${accountId}) as is_owner
      `;
      if (isOwner[0]?.is_owner) return false;

      await this.query`
        delete from group_organizers
        where group_id = ${groupId} and account_id = ${accountId}
      `;
    }

    if (!accountId) {
      const matchRows = await this.query<{ has_matches: boolean }[]>`
        select exists (select 1 from match_players where player_id = ${playerId}) as has_matches
      `;
      const hasMatches = Boolean(matchRows[0]?.has_matches);
      const gamesPlayed = playerRows[0].rated_games_played ?? 0;

      if (!hasMatches && gamesPlayed === 0) {
        await this.query`
          delete from round_sits where player_id = ${playerId}
        `;
        await this.query`
          delete from session_attendance where player_id = ${playerId}
        `;
        const deleted = await this.query<{ id: string }[]>`
          delete from players
          where id = ${playerId} and group_id = ${groupId}
          returning id
        `;
        return deleted.length > 0;
      }
    }

    const updated = await this.query<{ id: string }[]>`
      update players set active = false
      where id = ${playerId} and group_id = ${groupId}
      returning id
    `;
    if (updated.length > 0) {
      await this.query`
        update session_attendance sa
        set left_round = coalesce(s.current_round_number + 1, 1)
        from sessions s
        where sa.session_id = s.id
          and s.group_id = ${groupId}
          and s.status = 'active'
          and sa.player_id = ${playerId}
          and sa.left_round is null
      `;
    }
    return updated.length > 0;
  }

  async deletePlayer(playerId: string, groupId: string): Promise<void> {
    await this.removePlayerFromGroup(playerId, groupId);
  }

  async mergeGuestPlayers(
    groupId: string,
    targetPlayerId: string,
    sourcePlayerIds: readonly string[],
    mergedName: string,
  ): Promise<PlayerRecord> {
    return (await this.transaction(async (tx) => {
      const txRepo = tx as PostgresRepositories;
      const targetRows = await txRepo.query<PlayerRow[]>`
        select id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
        from players
        where id = ${targetPlayerId} and group_id = ${groupId}
      `;
      if (!targetRows[0] || targetRows[0].account_id !== null) {
        throw new Error("Target player is not a valid guest player in this group.");
      }

      for (const sId of sourcePlayerIds) {
        if (sId === targetPlayerId) continue;
        const sRows = await txRepo.query<PlayerRow[]>`
          select id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
          from players
          where id = ${sId} and group_id = ${groupId}
        `;
        if (!sRows[0] || sRows[0].account_id !== null) {
          throw new Error("One or more players to merge are not valid guest players in this group.");
        }
      }

      for (const sId of sourcePlayerIds) {
        if (sId === targetPlayerId) continue;

        // session_attendance
        const sAttendances = await txRepo.query<AttendanceRow[]>`
          select session_id, player_id, joined_round, left_round
          from session_attendance
          where player_id = ${sId}
        `;
        for (const sa of sAttendances) {
          const targetAtt = await txRepo.query<AttendanceRow[]>`
            select session_id, player_id, joined_round, left_round
            from session_attendance
            where session_id = ${sa.session_id} and player_id = ${targetPlayerId}
          `;
          if (targetAtt[0]) {
            const minJoined = Math.min(targetAtt[0].joined_round, sa.joined_round);
            const mergedLeft =
              targetAtt[0].left_round === null || sa.left_round === null
                ? null
                : Math.max(targetAtt[0].left_round, sa.left_round);
            await txRepo.query`
              update session_attendance
              set joined_round = ${minJoined}, left_round = ${mergedLeft}
              where session_id = ${sa.session_id} and player_id = ${targetPlayerId}
            `;
            await txRepo.query`
              delete from session_attendance
              where session_id = ${sa.session_id} and player_id = ${sId}
            `;
          } else {
            await txRepo.query`
              update session_attendance
              set player_id = ${targetPlayerId}
              where session_id = ${sa.session_id} and player_id = ${sId}
            `;
          }
        }

        // match_players
        const sMatches = await txRepo.query<MatchPlayerRow[]>`
          select match_id, player_id, team, rating_before, rating_after
          from match_players
          where player_id = ${sId}
        `;
        for (const sm of sMatches) {
          const targetMp = await txRepo.query<MatchPlayerRow[]>`
            select match_id, player_id
            from match_players
            where match_id = ${sm.match_id} and player_id = ${targetPlayerId}
          `;
          if (targetMp[0]) {
            await txRepo.query`
              delete from match_players
              where match_id = ${sm.match_id} and player_id = ${sId}
            `;
          } else {
            await txRepo.query`
              update match_players
              set player_id = ${targetPlayerId}
              where match_id = ${sm.match_id} and player_id = ${sId}
            `;
          }
        }

        // round_sits
        const sSits = await txRepo.query<SitRow[]>`
          select round_id, player_id
          from round_sits
          where player_id = ${sId}
        `;
        for (const ss of sSits) {
          const targetSit = await txRepo.query<SitRow[]>`
            select round_id, player_id
            from round_sits
            where round_id = ${ss.round_id} and player_id = ${targetPlayerId}
          `;
          if (targetSit[0]) {
            await txRepo.query`
              delete from round_sits
              where round_id = ${ss.round_id} and player_id = ${sId}
            `;
          } else {
            await txRepo.query`
              update round_sits
              set player_id = ${targetPlayerId}
              where round_id = ${ss.round_id} and player_id = ${sId}
            `;
          }
        }

        // delete source guest player row
        await txRepo.query`
          delete from players
          where id = ${sId} and group_id = ${groupId} and account_id is null
        `;
      }

      // Update target player name
      await txRepo.query`
        update players
        set name = ${mergedName.trim()}
        where id = ${targetPlayerId} and group_id = ${groupId}
      `;

      await replayRatings(groupId, txRepo);

      const finalRows = await txRepo.query<PlayerRow[]>`
        select id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
        from players
        where id = ${targetPlayerId} and group_id = ${groupId}
      `;
      if (!finalRows[0]) throw new Error("Failed to retrieve merged player.");
      return mapPlayer(finalRows[0]);
    })) as PlayerRecord;
  }


  async lockPartnerRequests(sessionId: string): Promise<void> {
    if (!this.inTransaction) throw new Error("Partner requests require a transaction.");
    await this.query`select pg_advisory_xact_lock(hashtextextended('pickleball:partner-requests:' || ${sessionId}, 0))`;
  }
  async listPartnerRequests(sessionId: string): Promise<readonly PartnerRequestRecord[]> {
    const rows = await this.query<PartnerRequestRow[]>`select id, session_id, requester_player_id, partner_player_id, status, created_at, resolved_at, version
      from session_partner_requests where session_id = ${sessionId}
      order by (status = 'pending') desc, created_at desc, id desc`;
    return rows.map(mapPartnerRequest);
  }
  async getPartnerRequest(requestId: string): Promise<PartnerRequestRecord | null> {
    const rows = await this.query<PartnerRequestRow[]>`select id, session_id, requester_player_id, partner_player_id, status, created_at, resolved_at, version
      from session_partner_requests where id = ${requestId}`;
    return rows[0] ? mapPartnerRequest(rows[0]) : null;
  }
  async insertPartnerRequest(request: PartnerRequestRecord): Promise<void> {
    await this.query`insert into session_partner_requests (id, session_id, requester_player_id, partner_player_id, status, created_at, resolved_at, version)
      values (${request.id}, ${request.sessionId}, ${request.requesterPlayerId}, ${request.partnerPlayerId}, ${request.status}, ${request.createdAt}, ${request.resolvedAt}, ${request.version})`;
  }
  async updatePartnerRequest(request: PartnerRequestRecord): Promise<void> {
    const rows = await this.query`update session_partner_requests set status = ${request.status}, resolved_at = ${request.resolvedAt}, version = ${request.version}
      where id = ${request.id} and session_id = ${request.sessionId} and version = ${request.version - 1} returning id`;
    if (!rows.length) throw new RepositoryConflictError("The request changed. Refresh and try again.");
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const rows = await this.query<SessionRow[]>`
      select id, group_id, court_count, court_player_counts, stay_together_pairs, status, current_round_number,
             started_at, ended_at, version, type, name
      from sessions where id = ${sessionId}
    `;
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async updateSessionName(sessionId: string, name: string): Promise<void> {
    await this.query`
      update sessions
      set name = ${name}
      where id = ${sessionId}
    `;
  }

  async deleteSession(sessionId: string, groupId: string): Promise<void> {
    await this.query`
      delete from sessions
      where id = ${sessionId} and group_id = ${groupId}
    `;
  }

  async listPlayers(groupId?: string, options?: { includeInactive?: boolean }): Promise<readonly PlayerRecord[]> {
    const rows = options?.includeInactive
      ? await this.query<PlayerRow[]>`
          select p.id, p.group_id, coalesce(a.name, p.name) as name, coalesce(p.gender, a.gender) as gender, p.initial_rating,
                 coalesce(a.rating, p.rating) as rating,
                 coalesce(a.rated_games_played, p.rated_games_played) as rated_games_played,
                 p.active, p.account_id,
                 a.username as username,
                 a.is_public as is_public,
                 a.visibility_settings as visibility_settings
          from players p
          left join player_accounts a on a.id = p.account_id
          where ${groupId ? this.query`p.group_id = ${groupId}` : this.query`1=1`}
          order by p.created_at, p.id
        `
      : await this.query<PlayerRow[]>`
          select p.id, p.group_id, coalesce(a.name, p.name) as name, coalesce(p.gender, a.gender) as gender, p.initial_rating,
                 coalesce(a.rating, p.rating) as rating,
                 coalesce(a.rated_games_played, p.rated_games_played) as rated_games_played,
                 p.active, p.account_id,
                 a.username as username,
                 a.is_public as is_public,
                 a.visibility_settings as visibility_settings
          from players p
          left join player_accounts a on a.id = p.account_id
          where ${groupId ? this.query`p.group_id = ${groupId}` : this.query`1=1`}
            and p.active = true
          order by p.created_at, p.id
        `;
    return rows.map(mapPlayer);
  }

  async listAttendance(sessionId: string): Promise<readonly AttendanceRecord[]> {
    const rows = await this.query<AttendanceRow[]>`
      select session_id, player_id, joined_round, left_round
      from session_attendance where session_id = ${sessionId} order by player_id
    `;
    return rows.map(mapAttendance);
  }

  async listStartedRounds(sessionId: string): Promise<readonly StartedRoundRecord[]> {
    type JsonMatch = Omit<MatchRow, "completed_at"> & { completed_at: string | null };
    type JsonMember = Omit<MatchPlayerRow, "rating_before" | "rating_after"> & {
      rating_before: number | string | null; rating_after: number | string | null;
    };
    type HistoryRow = RoundRow & { match_rows: JsonMatch[]; member_rows: JsonMember[]; sit_rows: SitRow[] };
    // One command keeps the whole history on the caller's connection/snapshot.
    // Explicit projections and aggregate ordering retain the public row contract.
    const rows = await this.query<HistoryRow[]>`
      select r.id, r.session_id, r.round_number, r.status, r.seed, r.score_breakdown,
             r.created_at, r.started_at, r.completed_at, r.version,
        coalesce((
          select jsonb_agg(to_jsonb(child) order by child.court_number)
          from (
            select m.id, m.round_id, m.court_number, m.status, m.team1_score,
                   m.team2_score, m.completed_at, m.version, m.rated
            from matches m where m.round_id = r.id
          ) child
        ), '[]'::jsonb) as match_rows,
        coalesce((
          select jsonb_agg(to_jsonb(child) order by child.match_id, child.team, child.player_id)
          from (
            select mp.match_id, mp.player_id, mp.team, mp.rating_before, mp.rating_after
            from match_players mp join matches m on m.id = mp.match_id
            where m.round_id = r.id
          ) child
        ), '[]'::jsonb) as member_rows,
        coalesce((
          select jsonb_agg(to_jsonb(child) order by child.player_id)
          from (
            select rs.round_id, rs.player_id from round_sits rs where rs.round_id = r.id
          ) child
        ), '[]'::jsonb) as sit_rows
      from rounds r where r.session_id = ${sessionId} order by r.round_number
    `;
    return rows.map(row => ({
      round: mapRound(row),
      matches: row.match_rows.map(match => mapMatch({ ...match,
        completed_at: match.completed_at === null ? null : new Date(match.completed_at),
      })),
      // PostgreSQL JSON represents non-finite float8 values as strings.
      matchPlayers: row.member_rows.map(member => mapMatchPlayer({ ...member,
        rating_before: member.rating_before === null ? null : Number(member.rating_before),
        rating_after: member.rating_after === null ? null : Number(member.rating_after),
      })),
      sits: row.sit_rows.map(mapSit),
    }));
  }

  async getRound(roundId: string): Promise<RoundRecord | null> {
    const rows = await this.query<RoundRow[]>`
      select id, session_id, round_number, status, seed, score_breakdown,
             created_at, started_at, completed_at, version
      from rounds where id = ${roundId}
    `;
    return rows[0] ? mapRound(rows[0]) : null;
  }

  async getRoundCompletionContext(roundId: string): Promise<RoundCompletionContext | null> {
    type CompletionRow = RoundRow & {
      pending_id: string | null; court_number: number; pending_status: MatchRow["status"];
      team1_score: number | null; team2_score: number | null; pending_completed_at: Date | null;
      pending_version: number; rated: boolean; player_count: number;
    };
    // Keep the round even when it has no pending matches. Use this.query so a
    // completion transaction reads its own writes on its pinned connection.
    const rows = await this.query<CompletionRow[]>`
      select r.id, r.session_id, r.round_number, r.status, r.seed, r.score_breakdown,
             r.created_at, r.started_at, r.completed_at, r.version,
             m.id as pending_id, m.court_number, m.status as pending_status,
             m.team1_score, m.team2_score, m.completed_at as pending_completed_at,
             m.version as pending_version, m.rated,
             (select count(*)::int from match_players mp where mp.match_id = m.id) as player_count
      from rounds r
      left join matches m on m.round_id = r.id and m.status = 'pending'
      where r.id = ${roundId}
      order by m.court_number
    `;
    if (!rows[0]) return null;
    return { round: mapRound(rows[0]), pendingMatches: rows.flatMap(row => row.pending_id === null ? [] : [{
      match: mapMatch({ id: row.pending_id, round_id: row.id, court_number: row.court_number,
        status: row.pending_status, team1_score: row.team1_score, team2_score: row.team2_score,
        completed_at: row.pending_completed_at, version: row.pending_version, rated: row.rated }),
      playerCount: row.player_count,
    }]) };
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    const rows = await this.query<MatchRow[]>`
      select id, round_id, court_number, status, team1_score, team2_score,
             completed_at, version, rated
      from matches where id = ${matchId}
    `;
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  async getMatchResultContexts(matchIds: readonly string[]): Promise<readonly MatchResultContext[]> {
    if (matchIds.length === 0) return [];
    const rows = await this.query<(MatchRow & {
      group_id: string; session_id: string;
      round_status: MatchResultContext["roundStatus"];
      session_status: MatchResultContext["sessionStatus"];
    })[]>`
      select m.id, m.round_id, m.court_number, m.status, m.team1_score, m.team2_score,
             m.completed_at, m.version, m.rated, s.group_id, s.id as session_id,
             r.status as round_status, s.status as session_status
      from matches m
      join rounds r on r.id = m.round_id
      join sessions s on s.id = r.session_id
      where m.id = any(${[...matchIds]}::text[])
    `;
    return rows.map(row => ({ match: mapMatch(row), groupId: row.group_id,
      sessionId: row.session_id, roundStatus: row.round_status, sessionStatus: row.session_status }));
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]) {
    await this.query`
      insert into sessions (
        id, group_id, court_count, court_player_counts, stay_together_pairs, status, current_round_number,
        started_at, ended_at, version, type, name
      ) values (
        ${session.id}, ${session.groupId}, ${session.courtCount}, ${session.courtPlayerCounts ?? []}, ${this.query.json((session.stayTogetherPairs ?? []).map(pair => [...pair]))}, ${session.status},
        ${session.currentRoundNumber}, ${session.startedAt}, ${session.endedAt}, ${session.version},
        ${session.type ?? "regular"}, ${session.name ?? null}
      )
    `;
    if (attendance.length > 0) {
      const rows = attendance.map((a) => ({
        session_id: a.sessionId,
        player_id: a.playerId,
        joined_round: a.joinedRound,
        left_round: a.leftRound,
      }));
      await this.query`
        insert into session_attendance ${this.query(rows, "session_id", "player_id", "joined_round", "left_round")}
        on conflict (session_id, player_id) do update set
          joined_round = excluded.joined_round,
          left_round = excluded.left_round
      `;
    }
  }

  async updateSession(session: SessionRecord) {
    const rows = await this.query<{ id: string }[]>`
      update sessions set
        court_count = ${session.courtCount}, court_player_counts = ${session.courtPlayerCounts ?? []}, stay_together_pairs = ${this.query.json((session.stayTogetherPairs ?? []).map(pair => [...pair]))}, status = ${session.status},
        current_round_number = ${session.currentRoundNumber}, ended_at = ${session.endedAt},
        version = ${session.version}, name = ${session.name ?? null}
      where id = ${session.id} and version = ${session.version - 1}
      returning id
    `;
    if (rows.length === 0) throw new RepositoryConflictError();
  }

  async saveAttendance(attendance: AttendanceRecord) {
    await this.query`
      insert into session_attendance (session_id, player_id, joined_round, left_round)
      values (
        ${attendance.sessionId}, ${attendance.playerId},
        ${attendance.joinedRound}, ${attendance.leftRound}
      )
      on conflict (session_id, player_id) do update set
        joined_round = excluded.joined_round,
        left_round = excluded.left_round
    `;
  }

  async insertStartedRound(record: StartedRoundRecord) {
    const existing = await this.query<{ id: string }[]>`
      select id from rounds where id = ${record.round.id}
    `;
    if (existing.length > 0) return;

    const { round, matches, matchPlayers, sits } = record;
    // RETURNING dependencies preserve parent-before-child writes in a single
    // command; the caller's transaction and session version check stay intact.
    await this.query`
      with inserted_round as (
        insert into rounds (
          id, session_id, round_number, status, seed, score_breakdown,
          created_at, started_at, completed_at, version
        ) values (
          ${round.id}, ${round.sessionId}, ${round.roundNumber}, ${round.status},
          ${round.seed}, ${this.query.json(round.scoreBreakdown as unknown as postgres.JSONValue)},
          ${round.createdAt}, ${round.startedAt}, ${round.completedAt}, ${round.version}
        ) returning id
      ), inserted_matches as (
        insert into matches (
          id, round_id, court_number, status, team1_score, team2_score, completed_at, version, rated
        )
        select v.* from unnest(
          ${matches.map(match => match.id)}::text[],
          ${matches.map(match => match.roundId)}::text[],
          ${matches.map(match => match.courtNumber)}::int[],
          ${matches.map(match => match.status)}::text[],
          ${matches.map(match => match.team1Score)}::int[],
          ${matches.map(match => match.team2Score)}::int[],
          ${matches.map(match => match.completedAt?.toISOString() ?? null)}::timestamptz[],
          ${matches.map(match => match.version)}::int[],
          ${this.query.array(matches.map(match => match.rated ?? true), 16)}::boolean[]
        ) as v(id, round_id, court_number, status, team1_score, team2_score, completed_at, version, rated)
        where exists (select 1 from inserted_round)
        returning id
      ), inserted_members as (
        insert into match_players (match_id, player_id, team, rating_before, rating_after)
        select v.* from unnest(
          ${matchPlayers.map(member => member.matchId)}::text[],
          ${matchPlayers.map(member => member.playerId)}::text[],
          ${matchPlayers.map(member => member.team)}::smallint[],
          ${matchPlayers.map(member => member.ratingBefore)}::float8[],
          ${matchPlayers.map(member => member.ratingAfter)}::float8[]
        ) as v(match_id, player_id, team, rating_before, rating_after)
        where exists (select 1 from inserted_round)
          and (select count(*) from inserted_matches) >= 0
        returning match_id
      )
      insert into round_sits (round_id, player_id)
      select v.* from unnest(
        ${sits.map(sit => sit.roundId)}::text[],
        ${sits.map(sit => sit.playerId)}::text[]
      ) as v(round_id, player_id)
      where exists (select 1 from inserted_round)
        and (select count(*) from inserted_members) >= 0
    `;
  }

  async insertMatch(match: MatchRecord, matchPlayers: readonly MatchPlayerRecord[]): Promise<void> {
    await this.query`
      insert into matches (
        id, round_id, court_number, status, team1_score, team2_score, completed_at, version, rated
      ) values (
        ${match.id}, ${match.roundId}, ${match.courtNumber}, ${match.status},
        ${match.team1Score}, ${match.team2Score}, ${match.completedAt}, ${match.version}, ${match.rated ?? true}
      )
    `;
    if (matchPlayers.length > 0) {
      const mpRows = matchPlayers.map((mp) => ({
        match_id: mp.matchId,
        player_id: mp.playerId,
        team: mp.team,
        rating_before: mp.ratingBefore,
        rating_after: mp.ratingAfter,
      }));
      await this.query`
        insert into match_players ${this.query(
          mpRows,
          "match_id",
          "player_id",
          "team",
          "rating_before",
          "rating_after",
        )}
      `;
    }
  }

  async updateMatch(match: MatchRecord) {
    const rows = await this.query<{ id: string }[]>`
      update matches set
        status = ${match.status}, team1_score = ${match.team1Score},
        team2_score = ${match.team2Score}, completed_at = ${match.completedAt},
        rated = ${match.rated ?? true},
        version = ${match.version}
      where id = ${match.id} and version = ${match.version - 1}
      returning id
    `;
    if (rows.length === 0) throw new RepositoryConflictError();
  }

  async updateMatches(matches: readonly MatchRecord[]): Promise<void> {
    if (matches.length === 0) return;
    if (new Set(matches.map(match => match.id)).size !== matches.length) throw new RepositoryConflictError();
    // A partial version conflict must roll back the rows that did match too.
    // Transactional callers must let the conflict escape their callback.
    if (!this.inTransaction) {
      await this.transaction(repository => repository.updateMatches(matches));
      return;
    }
    const rows = await this.query<{ id: string }[]>`
      update matches as m
      set status = v.status, team1_score = v.team1_score, team2_score = v.team2_score,
          completed_at = v.completed_at, version = v.version, rated = v.rated
      from unnest(
        ${matches.map(match => match.id)}::text[],
        ${matches.map(match => match.status)}::text[],
        ${matches.map(match => match.team1Score)}::int[],
        ${matches.map(match => match.team2Score)}::int[],
        ${matches.map(match => match.completedAt?.toISOString() ?? null)}::timestamptz[],
        ${matches.map(match => match.version)}::int[],
        ${this.query.array(matches.map(match => match.rated ?? true), 16)}::boolean[]
      ) as v(id, status, team1_score, team2_score, completed_at, version, rated)
      where m.id = v.id and m.version = v.version - 1
      returning m.id
    `;
    if (rows.length !== matches.length) throw new RepositoryConflictError();
  }

  async updateMatchPlayers(matchId: string, matchPlayers: readonly MatchPlayerRecord[]): Promise<void> {
    await this.query`delete from match_players where match_id = ${matchId}`;
    if (matchPlayers.length > 0) {
      const mpRows = matchPlayers.map((mp) => ({
        match_id: mp.matchId,
        player_id: mp.playerId,
        team: mp.team,
        rating_before: mp.ratingBefore,
        rating_after: mp.ratingAfter,
      }));
      await this.query`
        insert into match_players ${this.query(
          mpRows,
          "match_id",
          "player_id",
          "team",
          "rating_before",
          "rating_after",
        )}
      `;
    }
  }

  async deleteMatch(matchId: string) {
    await this.query`delete from match_players where match_id = ${matchId}`;
    await this.query`delete from matches where id = ${matchId}`;
  }

  async updateRound(round: RoundRecord) {
    const rows = await this.query<{ id: string }[]>`
      update rounds set
        status = ${round.status}, completed_at = ${round.completedAt}, version = ${round.version}
      where id = ${round.id} and version = ${round.version - 1}
      returning id
    `;
    if (rows.length === 0) throw new RepositoryConflictError();
  }

  async deleteRound(roundId: string) {
    await this.query`delete from rounds where id = ${roundId}`;
  }

  async listReplayMatches(groupId?: string): Promise<readonly ReplayMatch[]> {
    type ReplayRow = Pick<MatchRow, "id" | "status" | "team1_score" | "team2_score" | "completed_at"> & {
      group_id: string; team1: string[]; team2: string[]; synergy_eligible: boolean;
    };
    // Return one row per doubles match instead of repeating its metadata for
    // every participant. Explicit aggregate ordering preserves replay inputs.
    const rows = await this.query<ReplayRow[]>`
      select m.id, m.status, m.team1_score, m.team2_score, m.completed_at,
             s.group_id, (r.status = 'completed' or s.type = 'open_play') as synergy_eligible,
             array_agg(mp.player_id order by mp.player_id) filter (where mp.team = 1) as team1,
             array_agg(mp.player_id order by mp.player_id) filter (where mp.team = 2) as team2
      from matches m
      join rounds r on r.id = m.round_id
      join sessions s on s.id = r.session_id
      join match_players mp on mp.match_id = m.id
      where ${groupId ? this.query`s.group_id = ${groupId}` : this.query`1=1`}
        and m.status in ('completed', 'cancelled')
        and m.rated = true
        and m.completed_at is not null
      group by m.id, s.group_id, r.status, s.type
      having count(*) filter (where mp.team = 1) = 2
         and count(*) filter (where mp.team = 2) = 2
      order by m.completed_at, m.id
    `;
    return rows.flatMap((row): ReplayMatch[] => {
      if (!row.completed_at) return [];
      return [{
        id: row.id, groupId: row.group_id, synergyEligible: row.synergy_eligible,
        status: row.status === "cancelled" ? "cancelled" : "completed",
        completedAt: row.completed_at,
        team1: [row.team1[0], row.team1[1]], team2: [row.team2[0], row.team2[1]],
        team1Score: row.team1_score ?? 0, team2Score: row.team2_score ?? 0,
      }];
    });
  }

  async replaceRatingState(
    groupId: string,
    players: readonly (Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed"> & { accountId?: string | null })[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    let ratingWrites = this.query``;
    if (players.length > 0) {
      // Preserve the existing last-input-wins rule for account aliases. Roster
      // propagation must also run when the account itself is already current.
      const accountMap = new Map<string, { rating: number; ratedGamesPlayed: number }>();
      for (const player of players) {
        if (player.accountId) accountMap.set(player.accountId, player);
      }
      const accountIds = [...accountMap.keys()];
      ratingWrites = this.query`
        desired_players as (
          select * from unnest(
            ${players.map(player => player.id)}::text[],
            ${players.map(player => player.rating)}::float8[],
            ${players.map(player => player.ratedGamesPlayed)}::int[]
          ) as v(id, rating, games)
        ), desired_accounts as (
          select * from unnest(
            ${accountIds}::text[],
            ${accountIds.map(id => accountMap.get(id)!.rating)}::float8[],
            ${accountIds.map(id => accountMap.get(id)!.ratedGamesPlayed)}::int[]
          ) as v(account_id, rating, games)
        ), updated_accounts as (
          update player_accounts as a
          set rating = v.rating, rated_games_played = v.games
          from desired_accounts v
          where a.id = v.account_id
            and (a.rating, a.rated_games_played) is distinct from (v.rating, v.games)
          returning a.id
        ), desired_rosters as (
          select p.id,
                 case when a.account_id is not null then a.rating else d.rating end as rating,
                 case when a.account_id is not null then a.games else d.games end as games
          from players p
          left join desired_players d on d.id = p.id
          left join desired_accounts a on a.account_id = p.account_id
          where d.id is not null or a.account_id is not null
        ), updated_rosters as (
          update players as p
          set rating = v.rating, rated_games_played = v.games
          from desired_rosters v
          where p.id = v.id
            and (p.rating, p.rated_games_played) is distinct from (v.rating, v.games)
          returning p.id
        ),
      `;
    }

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

    // One command reconciles ratings and snapshots from the same replay values.
    // They modify separate tables and do not read each other's writes. An empty
    // player list still requires only snapshot-table write permissions.
    // Scoped rows absent from replay become null; supplied snapshots apply globally.
    await this.query`
      with ${ratingWrites} desired_snapshots as (
        select * from unnest(
          ${snapshotMatchIds}::text[],
          ${snapshotPlayerIds}::text[],
          ${snapshotRatingBefores}::float8[],
          ${snapshotRatingAfters}::float8[]
        ) as v(match_id, player_id, rating_before, rating_after)
      ), targets as (
        select mp.match_id, mp.player_id
        from match_players mp
        join matches m on m.id = mp.match_id
        join rounds r on r.id = m.round_id
        join sessions s on s.id = r.session_id
        where ${groupId ? this.query`s.group_id = ${groupId}` : this.query`1=1`}
        union
        select match_id, player_id from desired_snapshots
      )
      update match_players as mp
      set rating_before = v.rating_before, rating_after = v.rating_after
      from targets t
      left join desired_snapshots v on v.match_id = t.match_id and v.player_id = t.player_id
      where mp.match_id = t.match_id and mp.player_id = t.player_id
        and (mp.rating_before, mp.rating_after) is distinct from (v.rating_before, v.rating_after)
    `;
  }

  async getTournament(tournamentId: string): Promise<TournamentRecord | null> {
    const rows = await this.query<TournamentRow[]>`
      select id, group_id, name, status, divisions, brackets, created_at, updated_at, format, team_data
      from tournaments
      where id = ${tournamentId}
    `;
    return rows[0] ? mapTournament(rows[0]) : null;
  }

  async listTournaments(groupId: string): Promise<readonly TournamentRecord[]> {
    const rows = await this.query<TournamentRow[]>`
      select id, group_id, name, status, divisions, brackets, created_at, updated_at, format, team_data
      from tournaments
      where group_id = ${groupId}
      order by created_at desc
    `;
    return rows.map(mapTournament);
  }

  async createTournament(tournament: TournamentRecord): Promise<void> {
    await this.query`
      insert into tournaments (
        id, group_id, name, status, divisions, brackets, created_at, updated_at, format, team_data
      ) values (
        ${tournament.id},
        ${tournament.groupId},
        ${tournament.name},
        ${tournament.status},
        ${JSON.stringify(tournament.divisions)},
        ${JSON.stringify(tournament.brackets)},
        ${tournament.createdAt},
        ${tournament.updatedAt},
        ${tournament.format ?? "bracket"},
        ${tournament.teamData ? JSON.stringify(tournament.teamData) : null}
      )
    `;
  }

  async updateTournament(tournament: TournamentRecord): Promise<void> {
    await this.query`
      update tournaments set
        name = ${tournament.name},
        status = ${tournament.status},
        divisions = ${JSON.stringify(tournament.divisions)},
        brackets = ${JSON.stringify(tournament.brackets)},
        format = ${tournament.format ?? "bracket"},
        team_data = ${tournament.teamData ? JSON.stringify(tournament.teamData) : null},
        updated_at = ${tournament.updatedAt}
      where id = ${tournament.id}
    `;
  }

  async deleteTournament(tournamentId: string, groupId: string): Promise<void> {
    await this.query`
      delete from tournaments
      where id = ${tournamentId} and group_id = ${groupId}
    `;
  }
}

