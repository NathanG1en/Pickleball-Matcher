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
  PlayerSessionHistoryRecord,
  PublicGroupRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundSitRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";
import type { ScoreBreakdown } from "@/lib/matchmaking/types";

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
};

type PlayerRow = {
  id: string;
  group_id: string;
  name: string;
  initial_rating: number;
  rating: number;
  rated_games_played: number;
  active: boolean;
  account_id: string | null;
  username?: string | null;
  password_hash?: string | null;
  skill_level?: "beginner" | "intermediate" | "advanced" | null;
};

type PlayerAccountRow = {
  id: string;
  username: string;
  name: string;
  password_hash: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  initial_rating: number;
  created_at: Date;
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
});

const mapPlayerAccount = (row: PlayerAccountRow): PlayerAccountRecord => ({
  id: row.id,
  username: row.username,
  name: row.name,
  passwordHash: row.password_hash,
  skillLevel: row.skill_level,
  initialRating: row.initial_rating,
  createdAt: row.created_at,
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
    }[]>`
      select g.id, g.name, count(distinct p.id)::int as player_count,
        coalesce(bool_or(mine.id is not null), false) as is_member
      from groups g
      left join players p on p.group_id = g.id and p.active = true
      left join players mine on mine.group_id = g.id and mine.account_id = ${accountId ?? ""} and mine.active = true
      where g.is_public = true
        and (${term} = '' or strpos(lower(g.name), lower(${term})) > 0)
      group by g.id, g.name
      order by g.name
      limit 50
    `;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      playerCount: row.player_count,
      isMember: row.is_member,
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
        and exists (select 1 from players where id = ${accountId} and username is not null)
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
      from groups g join players p on p.id = g.owner_account_id
      where g.id = ${groupId} and p.username is not null
      union all
      select p.id as account_id, p.username, p.name, false as is_host
      from group_organizers o join players p on p.id = o.account_id
      where o.group_id = ${groupId} and p.username is not null
      order by is_host desc, name
    `;
    return rows.map((row) => ({ accountId: row.account_id, username: row.username, name: row.name, isHost: row.is_host }));
  }

  async getPlayerAccount(accountId: string): Promise<PlayerAccountRecord | null> {
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, password_hash, skill_level, initial_rating, created_at
      from players where id = ${accountId} and username is not null
    `;
    return rows[0] ? mapPlayerAccount(rows[0]) : null;
  }

  async getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null> {
    const rows = await this.query<PlayerAccountRow[]>`
      select id, username, name, password_hash, skill_level, initial_rating, created_at
      from players where username = ${username.trim().toLowerCase()}
    `;
    return rows[0] ? mapPlayerAccount(rows[0]) : null;
  }

  async createPlayerAccount(account: PlayerAccountRecord): Promise<void> {
    await this.query`
      insert into players (id, group_id, name, initial_rating, rating, rated_games_played, active, username, password_hash, skill_level, created_at)
      values (${account.id}, null, ${account.name}, ${account.initialRating}, ${account.initialRating}, 0, true, ${account.username.trim().toLowerCase()}, ${account.passwordHash}, ${account.skillLevel}, ${account.createdAt})
    `;
  }

  async updatePlayerAccountName(accountId: string, name: string): Promise<void> {
    await this.query.begin(async (transaction) => {
      const transactionQuery = transaction as unknown as postgres.Sql;
      await transactionQuery`update players set name = ${name} where id = ${accountId} and username is not null`;
      await transactionQuery`update players set name = ${name} where account_id = ${accountId}`;
    });
  }

  async updatePlayerAccountUsername(accountId: string, username: string): Promise<void> {
    await this.query`
      update players set username = ${username.trim().toLowerCase()}
      where id = ${accountId} and username is not null
    `;
  }

  async joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null> {
    const rows = await this.query<PlayerRow[]>`
      insert into players (id, group_id, name, initial_rating, rating, rated_games_played, active, account_id)
      select 'ply_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
             g.id, a.name, a.initial_rating, a.initial_rating, 0, true, a.id
      from groups g cross join players a
      where g.id = ${groupId} and (g.is_public = true or g.owner_account_id = ${accountId}) and a.id = ${accountId} and a.username is not null
      on conflict (group_id, account_id) where account_id is not null do update set active = true
      returning id, group_id, name, initial_rating, rating, rated_games_played, active, account_id
    `;
    if (rows[0]) return mapPlayer(rows[0]);

    const existing = await this.query<PlayerRow[]>`
      select id, group_id, name, initial_rating, rating, rated_games_played, active, account_id
      from players where account_id = ${accountId} and group_id = ${groupId}
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
        coalesce(res.rating, membership.initial_rating)::float8 as rating
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
             started_at, ended_at, version
      from sessions where group_id = ${groupId}
      order by started_at desc
    `;
    return rows.map(mapSession);
  }

  async createPlayer(player: PlayerRecord): Promise<void> {
    await this.query`
      insert into players (id, group_id, name, initial_rating, rating, rated_games_played, active, account_id)
      values (${player.id}, ${player.groupId}, ${player.name}, ${player.initialRating}, ${player.rating}, ${player.ratedGamesPlayed}, ${player.active}, ${player.accountId ?? null})
    `;
  }

  async updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }): Promise<void> {
    if (player.name !== undefined) {
      await this.query`
        update players set name = ${player.name}
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
    }
  }

  async deletePlayer(playerId: string, groupId: string): Promise<void> {
    await this.query`
      delete from players
      where id = ${playerId} and group_id = ${groupId}
    `;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const rows = await this.query<SessionRow[]>`
      select id, group_id, court_count, court_player_counts, status, current_round_number,
             started_at, ended_at, version
      from sessions where id = ${sessionId}
    `;
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listPlayers(groupId: string): Promise<readonly PlayerRecord[]> {
    const rows = await this.query<PlayerRow[]>`
      select p.id, p.group_id, p.name, p.initial_rating, p.rating, p.rated_games_played, p.active, p.account_id,
             coalesce(a.username, p.username) as username
      from players p
      left join players a on a.id = p.account_id and a.username is not null
      where p.group_id = ${groupId} order by p.created_at, p.id
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
        started_at, ended_at, version
      ) values (
        ${session.id}, ${session.groupId}, ${session.courtCount}, ${session.courtPlayerCounts ?? []}, ${session.status},
        ${session.currentRoundNumber}, ${session.startedAt}, ${session.endedAt}, ${session.version}
      )
    `;
    for (const item of attendance) await this.saveAttendance(item);
  }

  async updateSession(session: SessionRecord) {
    const rows = await this.query<{ id: string }[]>`
      update sessions set
        court_count = ${session.courtCount}, court_player_counts = ${session.courtPlayerCounts ?? []}, status = ${session.status},
        current_round_number = ${session.currentRoundNumber}, ended_at = ${session.endedAt},
        version = ${session.version}
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

  async listReplayMatches(groupId: string): Promise<readonly ReplayMatch[]> {
    type ReplayRow = MatchRow & { group_id: string; player_id: string; team: 1 | 2 };
    const rows = await this.query<ReplayRow[]>`
      select m.id, m.round_id, m.court_number, m.status, m.team1_score,
             m.team2_score, m.completed_at, m.version, m.rated, s.group_id,
             mp.player_id, mp.team
      from matches m
      join rounds r on r.id = m.round_id
      join sessions s on s.id = r.session_id
      join match_players mp on mp.match_id = m.id
      where s.group_id = ${groupId}
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
    players: readonly Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed">[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ) {
    for (const player of players) {
      await this.query`
        update players set rating = ${player.rating}, rated_games_played = ${player.ratedGamesPlayed}
        where id = ${player.id} and group_id = ${groupId}
      `;
    }
    await this.query`
      update match_players mp set rating_before = null, rating_after = null
      from matches m, rounds r, sessions s
      where mp.match_id = m.id and m.round_id = r.id and r.session_id = s.id
        and s.group_id = ${groupId}
    `;
    for (const [matchId, entries] of snapshots) {
      for (const entry of entries) {
        await this.query`
          update match_players set
            rating_before = ${entry.ratingBefore}, rating_after = ${entry.ratingAfter}
          where match_id = ${matchId} and player_id = ${entry.playerId}
        `;
      }
    }
  }
}
