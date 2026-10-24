import type postgres from "postgres";

import type { DomainRepository } from "@/lib/domain/repositories";
import type {
  AttendanceRecord,
  GroupRecord,
  GroupOrganizerRecord,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  PlayerAccountRecord,
  PlayerGender,
  PlayerSessionHistoryRecord,
  PlayerSynergyRecord,
  PairMatchSynergyResult,
  PublicGroupRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundSitRecord,
  SessionRecord,
  SessionType,
  StartedRoundRecord,
  TournamentRecord,
  TournamentDivision,
  TournamentBracket,
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

type GroupRow = {
  id: string;
  name: string;
  organizer_pin_hash: string;
  created_at: Date;
  is_public: boolean;
  owner_account_id: string | null;
};

type SessionRow = {
  id: string;
  group_id: string;
  court_count: number;
  court_player_counts: number[] | null;
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
};

type PlayerAccountRow = {
  id: string;
  username: string;
  name: string;
  gender?: "male" | "female" | null;
  is_public?: boolean;
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
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    status: row.status,
    divisions: Array.isArray(divisions) ? divisions : [],
    brackets: typeof brackets === "object" && brackets !== null ? brackets : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapGroup = (row: GroupRow): GroupRecord => ({
  id: row.id,
  name: row.name,
  organizerPinHash: row.organizer_pin_hash,
  createdAt: row.created_at,
  isPublic: row.is_public,
  ownerAccountId: row.owner_account_id,
});

const mapSession = (row: SessionRow): SessionRecord => ({
  id: row.id,
  groupId: row.group_id,
  courtCount: row.court_count,
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
});

const mapPlayerAccount = (row: PlayerAccountRow): PlayerAccountRecord => ({
  id: row.id,
  username: row.username,
  name: row.name,
  gender: (row.gender as PlayerGender) ?? undefined,
  isPublic: row.is_public ?? true,
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

  constructor(
    private readonly database: postgres.Sql,
    transaction?: postgres.TransactionSql,
  ) {
    this.query = (transaction ?? database) as unknown as postgres.Sql;
  }

  async transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T> {
    return (await this.database.begin((transaction) =>
      operation(new PostgresRepositories(this.database, transaction)),
    )) as unknown as T;
  }

  async getGroup(groupId: string): Promise<GroupRecord | null> {
    const rows = await this.query<GroupRow[]>`
      select id, name, organizer_pin_hash, created_at, is_public, owner_account_id
      from groups where id = ${groupId}
    `;
    return rows[0] ? mapGroup(rows[0]) : null;
  }

  async getGroupsByName(name: string): Promise<readonly GroupRecord[]> {
    const rows = await this.query<GroupRow[]>`
      select id, name, organizer_pin_hash, created_at, is_public, owner_account_id
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
      select id, username, name, gender, is_public, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts where id = ${accountId}
    `;
    return rows[0] ? mapPlayerAccount(rows[0]) : null;
  }

  async getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null> {
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, gender, is_public, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts where username = ${username.trim().toLowerCase()}
    `;
    return rows[0] ? mapPlayerAccount(rows[0]) : null;
  }

  async createPlayerAccount(account: PlayerAccountRecord): Promise<void> {
    await this.query`
      insert into player_accounts (id, username, name, gender, is_public, initial_rating, rating, rated_games_played, password_hash, skill_level, created_at)
      values (${account.id}, ${account.username.trim().toLowerCase()}, ${account.name}, ${account.gender ?? null}, ${account.isPublic ?? true}, ${account.initialRating}, ${account.initialRating}, 0, ${account.passwordHash}, ${account.skillLevel}, ${account.createdAt})
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

  async updatePlayerPrivacy(accountId: string, isPublic: boolean): Promise<void> {
    await this.query`
      update player_accounts set is_public = ${isPublic}
      where id = ${accountId}
    `;
  }

  async listPairSynergies(accountIds: readonly string[]): Promise<readonly PlayerSynergyRecord[]> {
    if (accountIds.length < 2) return [];
    const rows = await this.query<PlayerSynergyRow[]>`
      select account_id_1, account_id_2, matches_played, wins, synergy_score, updated_at
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
      select account_id_1, account_id_2, matches_played, wins, synergy_score, updated_at
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

  async recordMatchesSynergy(pairResults: readonly PairMatchSynergyResult[]): Promise<void> {
    if (pairResults.length === 0) return;
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
      select id, username, name, gender, is_public, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
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
      select id, username, name, gender, is_public, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
      from player_accounts
      where (${trimmed} = '' or username ilike ${searchTerm} or name ilike ${searchTerm})
      order by (${trimmed} != '' and username = ${trimmed}) desc, name asc, username asc
      limit ${limit}
    `;
    return rows.map(mapPlayerAccount);
  }

  async addPlayerToGroup(accountId: string, groupId: string): Promise<PlayerRecord | null> {
    const rows = await this.query<PlayerRow[]>`
      insert into players (id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id)
      select 'ply_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
             g.id, a.name, a.gender, a.initial_rating, a.rating, a.rated_games_played, true, a.id
      from groups g cross join player_accounts a
      where g.id = ${groupId} and a.id = ${accountId}
      on conflict (group_id, account_id) where account_id is not null do update set active = true, rating = excluded.rating, rated_games_played = excluded.rated_games_played
      returning id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
    `;
    if (rows[0]) return mapPlayer(rows[0]);

    const existing = await this.query<PlayerRow[]>`
      select p.id, p.group_id, coalesce(a.name, p.name) as name, coalesce(p.gender, a.gender) as gender, p.initial_rating,
             coalesce(a.rating, p.rating) as rating,
             coalesce(a.rated_games_played, p.rated_games_played) as rated_games_played,
             p.active, p.account_id, a.username
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
        select id, username, name, gender, is_public, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at
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
      };
    })) ?? null;
  }


  async joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null> {
    const rows = await this.query<PlayerRow[]>`
      insert into players (id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id)
      select 'ply_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
             g.id, a.name, a.gender, a.initial_rating, a.rating, a.rated_games_played, true, a.id
      from groups g cross join player_accounts a
      where g.id = ${groupId} and (g.is_public = true or g.owner_account_id = ${accountId}) and a.id = ${accountId}
      on conflict (group_id, account_id) where account_id is not null do update set active = true, rating = excluded.rating, rated_games_played = excluded.rated_games_played
      returning id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id
    `;
    if (rows[0]) return mapPlayer(rows[0]);

    const existing = await this.query<PlayerRow[]>`
      select p.id, p.group_id, coalesce(a.name, p.name) as name, coalesce(p.gender, a.gender) as gender, p.initial_rating,
             coalesce(a.rating, p.rating) as rating,
             coalesce(a.rated_games_played, p.rated_games_played) as rated_games_played,
             p.active, p.account_id, a.username
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
        select id, group_id, initial_rating from players where account_id = ${accountId}
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
          (array_agg(mp.rating_after order by m.completed_at desc)
            filter (where mp.rating_after is not null))[1] as rating
        from memberships p
        join match_players mp on mp.player_id = p.id
        join matches m on m.id = mp.match_id and m.status = 'completed'
        join rounds r on r.id = m.round_id
        join sessions s on s.id = r.session_id
        group by mp.player_id, s.id
      )
      select s.id as session_id, g.id as group_id, g.name as group_name,
        s.started_at, coalesce(res.wins, 0)::int as wins,
        coalesce(res.losses, 0)::int as losses,
        coalesce(res.rating, membership.initial_rating)::float8 as rating,
        s.type as type,
        s.name as session_name
      from memberships membership
      join groups g on g.id = membership.group_id
      join session_attendance sa on sa.player_id = membership.id
      join sessions s on s.id = sa.session_id
      left join results res on res.player_id = membership.id and res.session_id = s.id
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
    await this.query`
      insert into groups (id, name, organizer_pin_hash, created_at, is_public, owner_account_id)
      values (${group.id}, ${group.name}, ${group.organizerPinHash}, ${group.createdAt}, ${group.isPublic ?? false}, ${group.ownerAccountId ?? null})
    `;
  }

  async listSessions(groupId: string): Promise<readonly SessionRecord[]> {
    const rows = await this.query<SessionRow[]>`
      select id, group_id, court_count, court_player_counts, status, current_round_number,
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


  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const rows = await this.query<SessionRow[]>`
      select id, group_id, court_count, court_player_counts, status, current_round_number,
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
                 a.username as username
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
                 a.username as username
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
    const roundRows = await this.query<RoundRow[]>`
      select id, session_id, round_number, status, seed, score_breakdown,
             created_at, started_at, completed_at, version
      from rounds where session_id = ${sessionId} order by round_number
    `;
    if (roundRows.length === 0) return [];
    const roundIds = roundRows.map((row) => row.id);
    const matchRows = await this.query<MatchRow[]>`
      select id, round_id, court_number, status, team1_score, team2_score,
             completed_at, version, rated
      from matches where round_id in ${this.query(roundIds)} order by round_id, court_number
    `;
    const matchIds = matchRows.map((row) => row.id);
    const memberRows =
      matchIds.length === 0
        ? []
        : await this.query<MatchPlayerRow[]>`
            select match_id, player_id, team, rating_before, rating_after
            from match_players where match_id in ${this.query(matchIds)}
            order by match_id, team, player_id
          `;
    const sitRows = await this.query<SitRow[]>`
      select round_id, player_id from round_sits
      where round_id in ${this.query(roundIds)} order by round_id, player_id
    `;

    return roundRows.map((roundRow) => {
      const matches = matchRows.filter((row) => row.round_id === roundRow.id);
      const ids = new Set(matches.map((row) => row.id));
      return {
        round: mapRound(roundRow),
        matches: matches.map(mapMatch),
        matchPlayers: memberRows.filter((row) => ids.has(row.match_id)).map(mapMatchPlayer),
        sits: sitRows.filter((row) => row.round_id === roundRow.id).map(mapSit),
      };
    });
  }

  async getRound(roundId: string): Promise<RoundRecord | null> {
    const rows = await this.query<RoundRow[]>`
      select id, session_id, round_number, status, seed, score_breakdown,
             created_at, started_at, completed_at, version
      from rounds where id = ${roundId}
    `;
    return rows[0] ? mapRound(rows[0]) : null;
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    const rows = await this.query<MatchRow[]>`
      select id, round_id, court_number, status, team1_score, team2_score,
             completed_at, version, rated
      from matches where id = ${matchId}
    `;
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]) {
    await this.query`
      insert into sessions (
        id, group_id, court_count, court_player_counts, status, current_round_number,
        started_at, ended_at, version, type, name
      ) values (
        ${session.id}, ${session.groupId}, ${session.courtCount}, ${session.courtPlayerCounts ?? []}, ${session.status},
        ${session.currentRoundNumber}, ${session.startedAt}, ${session.endedAt}, ${session.version},
        ${session.type ?? "regular"}, ${session.name ?? null}
      )
    `;
    for (const item of attendance) await this.saveAttendance(item);
  }

  async updateSession(session: SessionRecord) {
    const rows = await this.query<{ id: string }[]>`
      update sessions set
        court_count = ${session.courtCount}, court_player_counts = ${session.courtPlayerCounts ?? []}, status = ${session.status},
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

    await this.query`
      insert into rounds (
        id, session_id, round_number, status, seed, score_breakdown,
        created_at, started_at, completed_at, version
      ) values (
        ${record.round.id}, ${record.round.sessionId}, ${record.round.roundNumber},
        ${record.round.status}, ${record.round.seed}, ${this.query.json(
          record.round.scoreBreakdown as unknown as postgres.JSONValue,
        )},
        ${record.round.createdAt}, ${record.round.startedAt}, ${record.round.completedAt},
        ${record.round.version}
      )
    `;
    for (const match of record.matches) {
      await this.query`
        insert into matches (
          id, round_id, court_number, status, team1_score, team2_score, completed_at, version, rated
        ) values (
          ${match.id}, ${match.roundId}, ${match.courtNumber}, ${match.status},
          ${match.team1Score}, ${match.team2Score}, ${match.completedAt}, ${match.version}, ${match.rated ?? true}
        )
      `;
    }
    for (const member of record.matchPlayers) {
      await this.query`
        insert into match_players (
          match_id, player_id, team, rating_before, rating_after
        ) values (
          ${member.matchId}, ${member.playerId}, ${member.team},
          ${member.ratingBefore}, ${member.ratingAfter}
        )
      `;
    }
    for (const sit of record.sits) {
      await this.query`
        insert into round_sits (round_id, player_id) values (${sit.roundId}, ${sit.playerId})
      `;
    }
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
    for (const member of matchPlayers) {
      await this.query`
        insert into match_players (
          match_id, player_id, team, rating_before, rating_after
        ) values (
          ${member.matchId}, ${member.playerId}, ${member.team},
          ${member.ratingBefore}, ${member.ratingAfter}
        )
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

  async updateMatchPlayers(matchId: string, matchPlayers: readonly MatchPlayerRecord[]): Promise<void> {
    await this.query`delete from match_players where match_id = ${matchId}`;
    for (const member of matchPlayers) {
      await this.query`
        insert into match_players (
          match_id, player_id, team, rating_before, rating_after
        ) values (
          ${member.matchId}, ${member.playerId}, ${member.team},
          ${member.ratingBefore}, ${member.ratingAfter}
        )
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
    type ReplayRow = MatchRow & { group_id: string; player_id: string; team: 1 | 2 };
    const rows = await this.query<ReplayRow[]>`
      select m.id, m.round_id, m.court_number, m.status, m.team1_score,
             m.team2_score, m.completed_at, m.version, m.rated, s.group_id,
             mp.player_id, mp.team
      from matches m
      join rounds r on r.id = m.round_id
      join sessions s on s.id = r.session_id
      join match_players mp on mp.match_id = m.id
      where ${groupId ? this.query`s.group_id = ${groupId}` : this.query`1=1`}
        and m.status in ('completed', 'cancelled')
        and m.rated = true
        and m.completed_at is not null
      order by m.completed_at, m.id, mp.team, mp.player_id
    `;
    const grouped = new Map<string, ReplayRow[]>();
    for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);

    return [...grouped.values()].flatMap((matchRows): ReplayMatch[] => {
      const first = matchRows[0];
      const team1 = matchRows.filter((row) => row.team === 1).map((row) => row.player_id);
      const team2 = matchRows.filter((row) => row.team === 2).map((row) => row.player_id);
      if (team1.length !== 2 || team2.length !== 2 || !first.completed_at) return [];
      return [
        {
          id: first.id,
          groupId: first.group_id,
          status: first.status === "cancelled" ? "cancelled" : "completed",
          completedAt: first.completed_at,
          team1: [team1[0], team1[1]],
          team2: [team2[0], team2[1]],
          team1Score: first.team1_score ?? 0,
          team2Score: first.team2_score ?? 0,
        },
      ];
    });
  }

  async replaceRatingState(
    groupId: string,
    players: readonly (Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed"> & { accountId?: string | null })[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    if (players.length > 0) {
      const ids = players.map((p) => p.id);
      const ratings = players.map((p) => p.rating);
      const games = players.map((p) => p.ratedGamesPlayed);
      await this.query`
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
        await this.query`
          update player_accounts as a
          set rating = v.rating,
              rated_games_played = v.games
          from unnest(${accountIds}::text[], ${accRatings}::float8[], ${accGames}::int[]) as v(account_id, rating, games)
          where a.id = v.account_id
        `;
        await this.query`
          update players as p
          set rating = v.rating,
              rated_games_played = v.games
          from unnest(${accountIds}::text[], ${accRatings}::float8[], ${accGames}::int[]) as v(account_id, rating, games)
          where p.account_id = v.account_id
        `;
      }
    }

    await this.query`
      update match_players mp set rating_before = null, rating_after = null
      from matches m, rounds r, sessions s
      where mp.match_id = m.id and m.round_id = r.id and r.session_id = s.id
        and ${groupId ? this.query`s.group_id = ${groupId}` : this.query`1=1`}
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
      await this.query`
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
    }
  }

  async getTournament(tournamentId: string): Promise<TournamentRecord | null> {
    const rows = await this.query<TournamentRow[]>`
      select id, group_id, name, status, divisions, brackets, created_at, updated_at
      from tournaments
      where id = ${tournamentId}
    `;
    return rows[0] ? mapTournament(rows[0]) : null;
  }

  async listTournaments(groupId: string): Promise<readonly TournamentRecord[]> {
    const rows = await this.query<TournamentRow[]>`
      select id, group_id, name, status, divisions, brackets, created_at, updated_at
      from tournaments
      where group_id = ${groupId}
      order by created_at desc
    `;
    return rows.map(mapTournament);
  }

  async createTournament(tournament: TournamentRecord): Promise<void> {
    await this.query`
      insert into tournaments (
        id, group_id, name, status, divisions, brackets, created_at, updated_at
      ) values (
        ${tournament.id},
        ${tournament.groupId},
        ${tournament.name},
        ${tournament.status},
        ${JSON.stringify(tournament.divisions)},
        ${JSON.stringify(tournament.brackets)},
        ${tournament.createdAt},
        ${tournament.updatedAt}
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

