import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { DomainRepository } from "@/lib/domain/repositories";
import type {
  AttendanceRecord,
  GroupRecord,
  GroupOrganizerRecord,
  PlayerAccountRecord,
  PlayerSessionHistoryRecord,
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
  created_at: string;
  is_public: number;
  owner_account_id: string | null;
}

interface PlayerAccountRow {
  id: string;
  username: string;
  name: string;
  gender?: "male" | "female" | null;
  password_hash: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  initial_rating: number;
  created_at: string;
}

interface PlayerRow {
  id: string;
  group_id: string;
  name: string;
  gender?: "male" | "female" | null;
  initial_rating: number;
  rating: number;
  ratedGamesPlayed?: number;
  rated_games_played: number;
  active: number;
  account_id: string | null;
  username?: string | null;
}

interface SessionRow {
  id: string;
  group_id: string;
  court_count: number;
  court_player_counts: string;
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
  rated: number;
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
        name TEXT NOT NULL UNIQUE,
        organizer_pin_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 0,
        owner_account_id TEXT REFERENCES players(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        gender TEXT,
        initial_rating REAL NOT NULL,
        rating REAL NOT NULL,
        rated_games_played INTEGER NOT NULL,
        active INTEGER NOT NULL,
        account_id TEXT REFERENCES players(id) ON DELETE SET NULL,
        username TEXT,
        password_hash TEXT,
        skill_level TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS players_group_account_unique_idx
        ON players(group_id, account_id) WHERE account_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS players_username_case_insensitive_unique_idx
        ON players(lower(username)) WHERE username IS NOT NULL;

      CREATE TABLE IF NOT EXISTS group_organizers (
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, account_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        court_count INTEGER NOT NULL,
        court_player_counts TEXT NOT NULL DEFAULT '[]',
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
        rated INTEGER NOT NULL DEFAULT 1,
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
      createdAt: new Date(row.created_at),
      isPublic: Boolean(row.is_public),
      ownerAccountId: row.owner_account_id,
    };
  }

  async getGroupsByName(name: string): Promise<readonly GroupRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM groups WHERE name = ?")
      .all(name.trim()) as unknown as GroupRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      organizerPinHash: row.organizer_pin_hash,
      createdAt: new Date(row.created_at),
      isPublic: Boolean(row.is_public),
      ownerAccountId: row.owner_account_id,
    }));
  }

  async listPublicGroups(search: string, accountId?: string) {
    const rows = this.db
      .prepare(`
        SELECT g.id, g.name, COUNT(DISTINCT p.id) AS player_count,
          MAX(CASE WHEN mine.id IS NOT NULL THEN 1 ELSE 0 END) AS is_member
        FROM groups g LEFT JOIN players p ON p.group_id = g.id AND p.active = 1
        LEFT JOIN players mine ON mine.group_id = g.id AND mine.account_id = ? AND mine.active = 1
        WHERE g.is_public = 1 AND (? = '' OR instr(lower(g.name), lower(?)) > 0)
        GROUP BY g.id, g.name ORDER BY g.name LIMIT 50
      `)
      .all(accountId ?? "", search.trim(), search.trim()) as unknown as { id: string; name: string; player_count: number; is_member: number }[];
    return rows.map((row) => ({ id: row.id, name: row.name, playerCount: row.player_count, isMember: Boolean(row.is_member) }));
  }

  async listAccountGroups(accountId: string) {
    const rows = this.db.prepare(`
      SELECT g.id, g.name, COUNT(DISTINCT roster.id) AS player_count,
        MAX(CASE WHEN mine.id IS NOT NULL THEN 1 ELSE 0 END) AS is_member,
        MAX(CASE WHEN g.owner_account_id = ? THEN 1 ELSE 0 END) AS is_host,
        MAX(CASE WHEN g.owner_account_id = ? OR org.account_id IS NOT NULL THEN 1 ELSE 0 END) AS is_organizer
      FROM groups g
      LEFT JOIN players roster ON roster.group_id = g.id AND roster.active = 1
      LEFT JOIN players mine ON mine.group_id = g.id AND mine.account_id = ? AND mine.active = 1
      LEFT JOIN group_organizers org ON org.group_id = g.id AND org.account_id = ?
      WHERE g.owner_account_id = ? OR org.account_id = ? OR mine.id IS NOT NULL
      GROUP BY g.id, g.name ORDER BY g.name
    `).all(accountId, accountId, accountId, accountId, accountId, accountId) as unknown as { id: string; name: string; player_count: number; is_member: number; is_host: number; is_organizer: number }[];
    return rows.map((row) => ({ id: row.id, name: row.name, playerCount: row.player_count, isMember: Boolean(row.is_member), isHost: Boolean(row.is_host), isOrganizer: Boolean(row.is_organizer) }));
  }

  async isGroupOrganizer(groupId: string, accountId: string): Promise<boolean> {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM groups WHERE id = ? AND owner_account_id = ?
      UNION ALL SELECT 1 FROM group_organizers WHERE group_id = ? AND account_id = ?
      LIMIT 1
    `).get(groupId, accountId, groupId, accountId));
  }

  async addGroupOrganizer(groupId: string, accountId: string): Promise<void> {
    this.db.prepare(`INSERT OR IGNORE INTO group_organizers (group_id, account_id)
      SELECT ?, ? WHERE EXISTS (SELECT 1 FROM groups WHERE id = ?)
      AND EXISTS (SELECT 1 FROM players WHERE id = ? AND username IS NOT NULL)`)
      .run(groupId, accountId, groupId, accountId);
  }

  async removeGroupOrganizer(groupId: string, accountId: string): Promise<void> {
    this.db.prepare("DELETE FROM group_organizers WHERE group_id = ? AND account_id = ?").run(groupId, accountId);
  }

  async listGroupOrganizers(groupId: string): Promise<readonly GroupOrganizerRecord[]> {
    const rows = this.db.prepare(`
      SELECT p.id AS account_id, p.username, p.name, 1 AS is_host
      FROM groups g JOIN players p ON p.id = g.owner_account_id
      WHERE g.id = ? AND p.username IS NOT NULL
      UNION ALL
      SELECT p.id AS account_id, p.username, p.name, 0 AS is_host
      FROM group_organizers o JOIN players p ON p.id = o.account_id
      WHERE o.group_id = ? AND p.username IS NOT NULL
      ORDER BY is_host DESC, name
    `).all(groupId, groupId) as unknown as { account_id: string; username: string; name: string; is_host: number }[];
    return rows.map((row) => ({ accountId: row.account_id, username: row.username, name: row.name, isHost: Boolean(row.is_host) }));
  }

  async getPlayerAccount(accountId: string): Promise<PlayerAccountRecord | null> {
    const row = this.db.prepare("SELECT id, username, name, gender, password_hash, skill_level, initial_rating, created_at FROM players WHERE id = ? AND username IS NOT NULL").get(accountId) as PlayerAccountRow | undefined;
    return row ? this.mapPlayerAccount(row) : null;
  }

  async getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null> {
    const row = this.db.prepare("SELECT id, username, name, gender, password_hash, skill_level, initial_rating, created_at FROM players WHERE username = ?").get(username.trim().toLowerCase()) as PlayerAccountRow | undefined;
    return row ? this.mapPlayerAccount(row) : null;
  }

  private mapPlayerAccount(row: PlayerAccountRow): PlayerAccountRecord {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      gender: (row.gender as "male" | "female") ?? undefined,
      passwordHash: row.password_hash,
      skillLevel: row.skill_level,
      initialRating: row.initial_rating,
      createdAt: new Date(row.created_at),
    };
  }

  async createPlayerAccount(account: PlayerAccountRecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO players (id, group_id, name, gender, initial_rating, rating, rated_games_played, active, account_id, username, password_hash, skill_level, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, 0, 1, NULL, ?, ?, ?, ?)
    `).run(account.id, account.name, account.gender ?? null, account.initialRating, account.initialRating, account.username.trim().toLowerCase(), account.passwordHash, account.skillLevel, account.createdAt.toISOString());
  }

  async updatePlayerAccountName(accountId: string, name: string): Promise<void> {
    this.db.prepare("UPDATE players SET name = ? WHERE id = ? AND username IS NOT NULL").run(name, accountId);
    this.db.prepare("UPDATE players SET name = ? WHERE account_id = ?").run(name, accountId);
  }

  async updatePlayerAccountUsername(accountId: string, username: string): Promise<void> {
    this.db.prepare("UPDATE players SET username = ? WHERE id = ? AND username IS NOT NULL").run(username.trim().toLowerCase(), accountId);
  }

  async updatePlayerAccountGender(accountId: string, gender: "male" | "female"): Promise<void> {
    this.db.prepare("UPDATE players SET gender = ? WHERE id = ? AND username IS NOT NULL").run(gender, accountId);
    this.db.prepare("UPDATE players SET gender = ? WHERE account_id = ?").run(gender, accountId);
  }

  async joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null> {
    const group = await this.getGroup(groupId);
    const account = await this.getPlayerAccount(accountId);
    if ((!group?.isPublic && group?.ownerAccountId !== accountId) || !account) return null;
    const existing = this.db.prepare("SELECT * FROM players WHERE group_id = ? AND account_id = ?").get(groupId, accountId) as PlayerRow | undefined;
    if (existing) {
      this.db.prepare("UPDATE players SET active = 1 WHERE id = ?").run(existing.id);
      return { ...this.mapPlayerRecord(existing), active: true };
    }
    const player: PlayerRecord = {
      id: `ply_${randomUUID().slice(0, 12)}`,
      groupId,
      accountId,
      name: account.name,
      initialRating: account.initialRating,
      rating: account.initialRating,
      ratedGamesPlayed: 0,
      active: true,
    };
    await this.createPlayer(player);
    return player;
  }

  async leavePublicGroup(accountId: string, groupId: string): Promise<boolean> {
    const group = await this.getGroup(groupId);
    if (group?.ownerAccountId === accountId) return false;
    this.db.prepare("DELETE FROM group_organizers WHERE group_id = ? AND account_id = ?").run(groupId, accountId);
    const result = this.db.prepare(
      "UPDATE players SET active = 0 WHERE group_id = ? AND account_id = ? AND active = 1",
    ).run(groupId, accountId);
    return result.changes > 0;
  }

  private mapPlayerRecord(row: PlayerRow): PlayerRecord {
    return {
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      initialRating: row.initial_rating,
      rating: row.rating,
      ratedGamesPlayed: row.rated_games_played,
      active: Boolean(row.active),
      accountId: row.account_id,
      username: row.username ?? null,
    };
  }

  async listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]> {
    const rows = this.db.prepare(`
      SELECT s.id AS session_id, g.id AS group_id, g.name AS group_name,
        s.started_at,
        SUM(CASE WHEN (mp.team = 1 AND m.team1_score > m.team2_score) OR (mp.team = 2 AND m.team2_score > m.team1_score) THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN (mp.team = 1 AND m.team1_score < m.team2_score) OR (mp.team = 2 AND m.team2_score < m.team1_score) THEN 1 ELSE 0 END) AS losses,
        COALESCE((
          SELECT mp2.rating_after FROM match_players mp2
          JOIN matches m2 ON m2.id = mp2.match_id
          JOIN rounds r2 ON r2.id = m2.round_id
          WHERE mp2.player_id = p.id AND r2.session_id = s.id AND m2.status = 'completed'
            AND mp2.rating_after IS NOT NULL
          ORDER BY m2.completed_at DESC LIMIT 1
        ), p.initial_rating) AS rating
      FROM players p
      JOIN groups g ON g.id = p.group_id
      JOIN session_attendance sa ON sa.player_id = p.id
      JOIN sessions s ON s.id = sa.session_id
      LEFT JOIN rounds r ON r.session_id = s.id
      LEFT JOIN matches m ON m.round_id = r.id AND m.status = 'completed'
      LEFT JOIN match_players mp ON mp.match_id = m.id AND mp.player_id = p.id
      WHERE p.account_id = ?
      GROUP BY p.id, s.id, g.id
      ORDER BY s.started_at DESC
    `).all(accountId) as unknown as {
      session_id: string; group_id: string; group_name: string; started_at: string;
      wins: number | null; losses: number | null; rating: number;
    }[];
    return rows.map((row) => ({
      sessionId: row.session_id,
      groupId: row.group_id,
      groupName: row.group_name,
      startedAt: new Date(row.started_at),
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      rating: row.rating,
    }));
  }

  async updateGroupVisibility(groupId: string, isPublic: boolean): Promise<void> {
    this.db.prepare("UPDATE groups SET is_public = ? WHERE id = ?").run(isPublic ? 1 : 0, groupId);
  }

  async updateGroupName(groupId: string, name: string): Promise<void> {
    this.db.prepare("UPDATE groups SET name = ? WHERE id = ?").run(name, groupId);
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
    this.db.prepare("DELETE FROM group_organizers WHERE group_id = ?").run(groupId);
    this.db.prepare("DELETE FROM players WHERE group_id = ?").run(groupId);
    this.db.prepare("DELETE FROM sessions WHERE group_id = ?").run(groupId);
  }

  async insertGroup(group: GroupRecord): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO groups (id, name, organizer_pin_hash, created_at, is_public, owner_account_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        group.id,
        group.name,
        group.organizerPinHash,
        group.createdAt.toISOString(),
        group.isPublic ? 1 : 0,
        group.ownerAccountId ?? null,
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
      courtPlayerCounts: JSON.parse(row.court_player_counts).length ? JSON.parse(row.court_player_counts) as (2 | 3 | 4)[] : undefined,
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
      courtPlayerCounts: JSON.parse(row.court_player_counts).length ? JSON.parse(row.court_player_counts) as (2 | 3 | 4)[] : undefined,
      status: row.status,
      currentRoundNumber: row.current_round_number,
      startedAt: new Date(row.started_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : null,
      version: row.version,
    }));
  }

  async listPlayers(groupId: string): Promise<readonly PlayerRecord[]> {
    const rows = this.db
      .prepare(`
        SELECT p.*, COALESCE(a.username, p.username) AS username
        FROM players p
        LEFT JOIN players a ON a.id = p.account_id AND a.username IS NOT NULL
        WHERE p.group_id = ?
        ORDER BY p.created_at, p.id
      `)
      .all(groupId) as unknown as PlayerRow[];
    return rows.map((row) => this.mapPlayerRecord(row));
  }

  async createPlayer(player: PlayerRecord): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO players (id, group_id, name, initial_rating, rating, rated_games_played, active, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        player.id,
        player.groupId,
        player.name,
        player.initialRating,
        player.rating,
        player.ratedGamesPlayed,
        player.active ? 1 : 0,
        player.accountId ?? null,
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
        rated: row.rated === 1,
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
      rated: row.rated === 1,
    };
  }

  async insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO sessions (id, group_id, court_count, court_player_counts, status, current_round_number, started_at, ended_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        session.id,
        session.groupId,
        session.courtCount,
        JSON.stringify(session.courtPlayerCounts ?? []),
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
        "UPDATE sessions SET court_count = ?, court_player_counts = ?, status = ?, current_round_number = ?, ended_at = ?, version = ? WHERE id = ? AND version = ?",
      )
      .run(
        session.courtCount,
        JSON.stringify(session.courtPlayerCounts ?? []),
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
      "INSERT INTO matches (id, round_id, court_number, status, team1_score, team2_score, completed_at, version, rated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        match.rated === false ? 0 : 1,
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
        "UPDATE matches SET status = ?, team1_score = ?, team2_score = ?, completed_at = ?, version = ?, rated = ? WHERE id = ? AND version = ?",
      )
      .run(
        match.status,
        match.team1Score,
        match.team2Score,
        match.completedAt ? match.completedAt.toISOString() : null,
        match.version,
        match.rated === false ? 0 : 1,
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
           AND m.rated = 1
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
