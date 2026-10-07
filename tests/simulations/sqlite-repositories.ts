import { DatabaseSync } from "node:sqlite";
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
import { RepositoryConflictError } from "@/lib/db/postgres-repositories";

interface GroupRow {
  id: string;
  name: string;
  organizer_pin_hash: string;
  public_share_id: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  group_id: string;
  court_count: number;
  status: "active" | "completed";
  current_round_number: number;
  started_at: string;
  ended_at: string | null;
  version: number;
}

interface PlayerRow {
  id: string;
  group_id: string;
  name: string;
  initial_rating: number;
  rating: number;
  rated_games_played: number;
  active: number;
  created_at: string;
}

interface AttendanceRow {
  session_id: string;
  player_id: string;
  joined_round: number;
  left_round: number | null;
}

interface RoundRow {
  id: string;
  session_id: string;
  round_number: number;
  status: "started" | "completed" | "cancelled";
  seed: number;
  score_breakdown: string;
  created_at: string;
  started_at: string;
  completed_at: string | null;
  version: number;
}

interface MatchRow {
  id: string;
  round_id: string;
  court_number: number;
  status: "pending" | "completed" | "cancelled";
  team1_score: number | null;
  team2_score: number | null;
  completed_at: string | null;
  version: number;
}

interface MatchPlayerRow {
  match_id: string;
  player_id: string;
  team: 1 | 2;
  rating_before: number | null;
  rating_after: number | null;
}

interface RoundSitRow {
  round_id: string;
  player_id: string;
}

export class SqliteDomainRepository implements DomainRepository {
  public readonly db: DatabaseSync;
  private depth = 0;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        organizer_pin_hash TEXT NOT NULL,
        public_share_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        initial_rating REAL NOT NULL,
        rating REAL NOT NULL,
        rated_games_played INTEGER NOT NULL,
        active INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        court_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        current_round_number INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_attendance (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        joined_round INTEGER NOT NULL,
        left_round INTEGER,
        PRIMARY KEY (session_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        seed INTEGER NOT NULL,
        score_breakdown TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        version INTEGER NOT NULL,
        UNIQUE (session_id, round_number)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        court_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        team1_score INTEGER,
        team2_score INTEGER,
        completed_at TEXT,
        version INTEGER NOT NULL,
        UNIQUE (round_id, court_number)
      );

      CREATE TABLE IF NOT EXISTS match_players (
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id),
        team INTEGER NOT NULL,
        rating_before REAL,
        rating_after REAL,
        PRIMARY KEY (match_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS round_sits (
        round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        player_id TEXT NOT NULL REFERENCES players(id),
        PRIMARY KEY (round_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS simulation_sessions (
        session_number INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        attendees_count INTEGER NOT NULL,
        attendee_names TEXT NOT NULL,
        court_count INTEGER NOT NULL,
        round_count INTEGER NOT NULL,
        mae REAL NOT NULL,
        strongest_true_player TEXT NOT NULL,
        strongest_app_player TEXT NOT NULL,
        weakest_true_player TEXT NOT NULL,
        weakest_app_player TEXT NOT NULL,
        rank_correlation REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS simulation_player_metrics (
        session_number INTEGER NOT NULL,
        player_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        preset TEXT NOT NULL,
        attended_this_session INTEGER NOT NULL,
        sessions_attended_total INTEGER NOT NULL,
        games_played_total INTEGER NOT NULL,
        true_elo REAL NOT NULL,
        app_elo REAL NOT NULL,
        absolute_error REAL NOT NULL,
        true_rank INTEGER NOT NULL,
        app_rank INTEGER NOT NULL,
        PRIMARY KEY (session_number, player_id)
      );

      CREATE TABLE IF NOT EXISTS simulation_matches_log (
        id TEXT PRIMARY KEY,
        session_number INTEGER NOT NULL,
        round_number INTEGER NOT NULL,
        court_number INTEGER NOT NULL,
        team1_p1 TEXT NOT NULL,
        team1_p2 TEXT NOT NULL,
        team2_p1 TEXT NOT NULL,
        team2_p2 TEXT NOT NULL,
        team1_true_elo REAL NOT NULL,
        team2_true_elo REAL NOT NULL,
        p_team1_wins REAL NOT NULL,
        winner INTEGER NOT NULL,
        team1_score INTEGER NOT NULL,
        team2_score INTEGER NOT NULL,
        team1_app_elo_before REAL NOT NULL,
        team2_app_elo_before REAL NOT NULL
      );
    `);
  }

  async transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T> {
    const sp = `sp_${this.depth++}`;
    this.db.exec(`SAVEPOINT ${sp}`);
    try {
      const result = await operation(this);
      this.db.exec(`RELEASE ${sp}`);
      return result;
    } catch (error) {
      this.db.exec(`ROLLBACK TO ${sp}`);
      throw error;
    } finally {
      this.depth--;
    }
  }

  async getGroup(groupId: string): Promise<GroupRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM groups WHERE id = ?")
      .get(groupId) as GroupRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      organizerPinHash: row.organizer_pin_hash,
      publicShareId: row.public_share_id,
      createdAt: new Date(row.created_at),
    };
  }

  async getGroupByShareId(shareId: string): Promise<GroupRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM groups WHERE public_share_id = ?")
      .get(shareId) as GroupRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      organizerPinHash: row.organizer_pin_hash,
      publicShareId: row.public_share_id,
      createdAt: new Date(row.created_at),
    };
  }

  async insertGroup(group: GroupRecord): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO groups (id, name, organizer_pin_hash, public_share_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        group.id,
        group.name,
        group.organizerPinHash,
        group.publicShareId,
        group.createdAt.toISOString(),
      );
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(sessionId) as SessionRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      groupId: row.group_id,
      courtCount: row.court_count,
      status: row.status,
      currentRoundNumber: row.current_round_number,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      version: row.version,
    };
  }

  async listSessions(groupId: string): Promise<readonly SessionRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM sessions WHERE group_id = ? ORDER BY started_at DESC")
      .all(groupId) as unknown as SessionRow[];
    return rows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      courtCount: row.court_count,
      status: row.status,
      currentRoundNumber: row.current_round_number,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      version: row.version,
    }));
  }

  async listPlayers(groupId: string): Promise<readonly PlayerRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM players WHERE group_id = ?")
      .all(groupId) as unknown as PlayerRow[];
    return rows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      initialRating: row.initial_rating,
      rating: row.rating,
      ratedGamesPlayed: row.rated_games_played,
      active: Boolean(row.active),
    }));
  }

  async createPlayer(player: PlayerRecord): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO players (id, group_id, name, initial_rating, rating, rated_games_played, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        player.id,
        player.groupId,
        player.name,
        player.initialRating,
        player.rating,
        player.ratedGamesPlayed,
        player.active ? 1 : 0,
        new Date().toISOString(),
      );
  }

  async updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }): Promise<void> {
    if (player.name !== undefined) {
      this.db
        .prepare("UPDATE players SET name = ? WHERE id = ? AND group_id = ?")
        .run(player.name, player.id, player.groupId);
    }
    if (player.active !== undefined) {
      this.db
        .prepare("UPDATE players SET active = ? WHERE id = ? AND group_id = ?")
        .run(player.active ? 1 : 0, player.id, player.groupId);
    }
    if (player.initialRating !== undefined) {
      this.db
        .prepare("UPDATE players SET initial_rating = ? WHERE id = ? AND group_id = ?")
        .run(player.initialRating, player.id, player.groupId);
    }
  }

  async deletePlayer(playerId: string, groupId: string): Promise<void> {
    this.db
      .prepare("DELETE FROM players WHERE id = ? AND group_id = ?")
      .run(playerId, groupId);
  }

  async listAttendance(sessionId: string): Promise<readonly AttendanceRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM session_attendance WHERE session_id = ?")
      .all(sessionId) as unknown as AttendanceRow[];
    return rows.map((row) => ({
      sessionId: row.session_id,
      playerId: row.player_id,
      joinedRound: row.joined_round,
      leftRound: row.left_round,
    }));
  }

  async listStartedRounds(sessionId: string): Promise<readonly StartedRoundRecord[]> {
    const rounds = (this.db
      .prepare("SELECT * FROM rounds WHERE session_id = ? ORDER BY round_number ASC")
      .all(sessionId) as unknown as RoundRow[]).map((row): RoundRecord => ({
      id: row.id,
      sessionId: row.session_id,
      roundNumber: row.round_number,
      status: row.status,
      seed: row.seed,
      scoreBreakdown: JSON.parse(row.score_breakdown) as ScoreBreakdown,
      createdAt: new Date(row.created_at),
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      version: row.version,
    }));

    return rounds.map((round) => {
      const matchRows = this.db
        .prepare("SELECT * FROM matches WHERE round_id = ? ORDER BY court_number ASC")
        .all(round.id) as unknown as MatchRow[];
      const matches: MatchRecord[] = matchRows.map((row) => ({
        id: row.id,
        roundId: row.round_id,
        courtNumber: row.court_number,
        status: row.status,
        team1Score: row.team1_score,
        team2Score: row.team2_score,
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
        version: row.version,
      }));

      const matchIds = matches.map((m) => m.id);
      let matchPlayers: MatchPlayerRecord[] = [];
      if (matchIds.length > 0) {
        const placeholders = matchIds.map(() => "?").join(",");
        const mpRows = this.db
          .prepare(`SELECT * FROM match_players WHERE match_id IN (${placeholders})`)
          .all(...matchIds) as unknown as MatchPlayerRow[];
        matchPlayers = mpRows.map((row) => ({
          matchId: row.match_id,
          playerId: row.player_id,
          team: row.team,
          ratingBefore: row.rating_before,
          ratingAfter: row.rating_after,
        }));
      }

      const sitRows = this.db
        .prepare("SELECT * FROM round_sits WHERE round_id = ?")
        .all(round.id) as unknown as RoundSitRow[];
      const sits: RoundSitRecord[] = sitRows.map((row) => ({
        roundId: row.round_id,
        playerId: row.player_id,
      }));

      return {
        round,
        matches,
        matchPlayers,
        sits,
      };
    });
  }

  async getRound(roundId: string): Promise<RoundRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM rounds WHERE id = ?")
      .get(roundId) as RoundRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      roundNumber: row.round_number,
      status: row.status,
      seed: row.seed,
      scoreBreakdown: JSON.parse(row.score_breakdown) as ScoreBreakdown,
      createdAt: new Date(row.created_at),
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      version: row.version,
    };
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM matches WHERE id = ?")
      .get(matchId) as MatchRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      roundId: row.round_id,
      courtNumber: row.court_number,
      status: row.status,
      team1Score: row.team1_score,
      team2Score: row.team2_score,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      version: row.version,
    };
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO sessions (id, group_id, court_count, status, current_round_number, started_at, ended_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        session.id,
        session.groupId,
        session.courtCount,
        session.status,
        session.currentRoundNumber,
        session.startedAt.toISOString(),
        session.endedAt ? session.endedAt.toISOString() : null,
        session.version,
      );
    for (const item of attendance) {
      await this.saveAttendance(item);
    }
  }

  async updateSession(session: SessionRecord): Promise<void> {
    const result = this.db
      .prepare(
        "UPDATE sessions SET court_count = ?, status = ?, current_round_number = ?, ended_at = ?, version = ? WHERE id = ? AND version = ?",
      )
      .run(
        session.courtCount,
        session.status,
        session.currentRoundNumber,
        session.endedAt ? session.endedAt.toISOString() : null,
        session.version,
        session.id,
        session.version - 1,
      );
    if (result.changes === 0) throw new RepositoryConflictError();
  }

  async saveAttendance(attendance: AttendanceRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO session_attendance (session_id, player_id, joined_round, left_round)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (session_id, player_id) DO UPDATE SET
           joined_round = excluded.joined_round,
           left_round = excluded.left_round`,
      )
      .run(
        attendance.sessionId,
        attendance.playerId,
        attendance.joinedRound,
        attendance.leftRound,
      );
  }

  async insertStartedRound(record: StartedRoundRecord): Promise<void> {
    const existing = this.db
      .prepare("SELECT id FROM rounds WHERE id = ?")
      .get(record.round.id);
    if (existing) return;

    this.db
      .prepare(
        "INSERT INTO rounds (id, session_id, round_number, status, seed, score_breakdown, created_at, started_at, completed_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.round.id,
        record.round.sessionId,
        record.round.roundNumber,
        record.round.status,
        record.round.seed,
        JSON.stringify(record.round.scoreBreakdown),
        record.round.createdAt.toISOString(),
        record.round.startedAt.toISOString(),
        record.round.completedAt ? record.round.completedAt.toISOString() : null,
        record.round.version,
      );

    const insertMatch = this.db.prepare(
      "INSERT INTO matches (id, round_id, court_number, status, team1_score, team2_score, completed_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const match of record.matches) {
      insertMatch.run(
        match.id,
        match.roundId,
        match.courtNumber,
        match.status,
        match.team1Score,
        match.team2Score,
        match.completedAt ? match.completedAt.toISOString() : null,
        match.version,
      );
    }

    const insertMP = this.db.prepare(
      "INSERT INTO match_players (match_id, player_id, team, rating_before, rating_after) VALUES (?, ?, ?, ?, ?)",
    );
    for (const member of record.matchPlayers) {
      insertMP.run(
        member.matchId,
        member.playerId,
        member.team,
        member.ratingBefore,
        member.ratingAfter,
      );
    }

    const insertSit = this.db.prepare(
      "INSERT INTO round_sits (round_id, player_id) VALUES (?, ?)",
    );
    for (const sit of record.sits) {
      insertSit.run(sit.roundId, sit.playerId);
    }
  }

  async updateMatch(match: MatchRecord): Promise<void> {
    const result = this.db
      .prepare(
        "UPDATE matches SET status = ?, team1_score = ?, team2_score = ?, completed_at = ?, version = ? WHERE id = ? AND version = ?",
      )
      .run(
        match.status,
        match.team1Score,
        match.team2Score,
        match.completedAt ? match.completedAt.toISOString() : null,
        match.version,
        match.id,
        match.version - 1,
      );
    if (result.changes === 0) throw new RepositoryConflictError();
  }

  async updateRound(round: RoundRecord): Promise<void> {
    const result = this.db
      .prepare(
        "UPDATE rounds SET status = ?, completed_at = ?, version = ? WHERE id = ? AND version = ?",
      )
      .run(
        round.status,
        round.completedAt ? round.completedAt.toISOString() : null,
        round.version,
        round.id,
        round.version - 1,
      );
    if (result.changes === 0) throw new RepositoryConflictError();
  }

  async deleteRound(roundId: string): Promise<void> {
    this.db.prepare("DELETE FROM rounds WHERE id = ?").run(roundId);
  }

  async listReplayMatches(groupId: string): Promise<readonly ReplayMatch[]> {
    type Row = {
      id: string;
      group_id: string;
      status: string;
      team1_score: number | null;
      team2_score: number | null;
      completed_at: string;
      player_id: string;
      team: number;
    };

    const rows = this.db
      .prepare(
        `SELECT m.id, s.group_id, m.status, m.team1_score, m.team2_score,
                m.completed_at, mp.player_id, mp.team
         FROM matches m
         JOIN rounds r ON r.id = m.round_id
         JOIN sessions s ON s.id = r.session_id
         JOIN match_players mp ON mp.match_id = m.id
         WHERE s.group_id = ?
           AND m.status IN ('completed', 'cancelled')
           AND m.completed_at IS NOT NULL
         ORDER BY m.completed_at ASC, m.id ASC, mp.team ASC, mp.player_id ASC`,
      )
      .all(groupId) as Row[];

    const grouped = new Map<string, Row[]>();
    for (const row of rows) {
      grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);
    }

    return [...grouped.values()].flatMap((matchRows): ReplayMatch[] => {
      const first = matchRows[0];
      const team1 = matchRows.filter((r) => r.team === 1).map((r) => r.player_id);
      const team2 = matchRows.filter((r) => r.team === 2).map((r) => r.player_id);
      if (team1.length !== 2 || team2.length !== 2 || !first.completed_at) return [];
      return [
        {
          id: first.id,
          groupId: first.group_id,
          status: first.status === "cancelled" ? "cancelled" : "completed",
          completedAt: new Date(first.completed_at),
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
  ): Promise<void> {
    const updatePlayer = this.db.prepare(
      "UPDATE players SET rating = ?, rated_games_played = ? WHERE id = ? AND group_id = ?",
    );
    for (const player of players) {
      updatePlayer.run(player.rating, player.ratedGamesPlayed, player.id, groupId);
    }

    this.db
      .prepare(
        `UPDATE match_players SET rating_before = NULL, rating_after = NULL
         WHERE match_id IN (
           SELECT m.id FROM matches m
           JOIN rounds r ON r.id = m.round_id
           JOIN sessions s ON s.id = r.session_id
           WHERE s.group_id = ?
         )`,
      )
      .run(groupId);

    const updateMP = this.db.prepare(
      "UPDATE match_players SET rating_before = ?, rating_after = ? WHERE match_id = ? AND player_id = ?",
    );
    for (const [matchId, entries] of snapshots) {
      for (const entry of entries) {
        updateMP.run(entry.ratingBefore, entry.ratingAfter, matchId, entry.playerId);
      }
    }
  }
}
