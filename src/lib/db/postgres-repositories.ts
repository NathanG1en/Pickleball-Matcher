import type postgres from "postgres";

import type { DomainRepository } from "@/lib/domain/repositories";
import type {
  AttendanceRecord,
  GroupRecord,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
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
  public_share_id: string;
  created_at: Date;
};

type SessionRow = {
  id: string;
  group_id: string;
  court_count: number;
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
  publicShareId: row.public_share_id,
  createdAt: row.created_at,
});

const mapSession = (row: SessionRow): SessionRecord => ({
  id: row.id,
  groupId: row.group_id,
  courtCount: row.court_count,
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
      select id, name, organizer_pin_hash, public_share_id, created_at
      from groups where id = ${groupId}
    `;
    return rows[0] ? mapGroup(rows[0]) : null;
  }

  async getGroupsByName(name: string): Promise<readonly GroupRecord[]> {
    const rows = await this.query<GroupRow[]>`
      select id, name, organizer_pin_hash, public_share_id, created_at
      from groups where name = ${name.trim()}
    `;
    return rows.map(mapGroup);
  }

  async getGroupByShareId(shareId: string): Promise<GroupRecord | null> {
    const rows = await this.query<GroupRow[]>`
      select id, name, organizer_pin_hash, public_share_id, created_at
      from groups where public_share_id = ${shareId}
    `;
    return rows[0] ? mapGroup(rows[0]) : null;
  }

  async insertGroup(group: GroupRecord): Promise<void> {
    await this.query`
      insert into groups (id, name, organizer_pin_hash, public_share_id, created_at)
      values (${group.id}, ${group.name}, ${group.organizerPinHash}, ${group.publicShareId}, ${group.createdAt})
    `;
  }

  async listSessions(groupId: string): Promise<readonly SessionRecord[]> {
    const rows = await this.query<SessionRow[]>`
      select id, group_id, court_count, status, current_round_number,
             started_at, ended_at, version
      from sessions where group_id = ${groupId}
      order by started_at desc
    `;
    return rows.map(mapSession);
  }

  async createPlayer(player: PlayerRecord): Promise<void> {
    await this.query`
      insert into players (id, group_id, name, initial_rating, rating, rated_games_played, active)
      values (${player.id}, ${player.groupId}, ${player.name}, ${player.initialRating}, ${player.rating}, ${player.ratedGamesPlayed}, ${player.active})
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
      select id, group_id, court_count, status, current_round_number,
             started_at, ended_at, version
      from sessions where id = ${sessionId}
    `;
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listPlayers(groupId: string): Promise<readonly PlayerRecord[]> {
    const rows = await this.query<PlayerRow[]>`
      select id, group_id, name, initial_rating, rating, rated_games_played, active
      from players where group_id = ${groupId} order by created_at, id
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
             completed_at, version
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
             completed_at, version
      from matches where id = ${matchId}
    `;
    return rows[0] ? mapMatch(rows[0]) : null;
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]) {
    await this.query`
      insert into sessions (
        id, group_id, court_count, status, current_round_number,
        started_at, ended_at, version
      ) values (
        ${session.id}, ${session.groupId}, ${session.courtCount}, ${session.status},
        ${session.currentRoundNumber}, ${session.startedAt}, ${session.endedAt}, ${session.version}
      )
    `;
    for (const item of attendance) await this.saveAttendance(item);
  }

  async updateSession(session: SessionRecord) {
    const rows = await this.query<{ id: string }[]>`
      update sessions set
        court_count = ${session.courtCount}, status = ${session.status},
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
          id, round_id, court_number, status, team1_score, team2_score, completed_at, version
        ) values (
          ${match.id}, ${match.roundId}, ${match.courtNumber}, ${match.status},
          ${match.team1Score}, ${match.team2Score}, ${match.completedAt}, ${match.version}
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
             m.team2_score, m.completed_at, m.version, s.group_id,
             mp.player_id, mp.team
      from matches m
      join rounds r on r.id = m.round_id
      join sessions s on s.id = r.session_id
      join match_players mp on mp.match_id = m.id
      where s.group_id = ${groupId}
        and m.status in ('completed', 'cancelled')
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
