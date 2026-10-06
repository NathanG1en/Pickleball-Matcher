import type {
  AttendanceRecord,
  MatchRecord,
  PlayerRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

export interface DomainRepository {
  transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  listPlayers(groupId: string): Promise<readonly PlayerRecord[]>;
  listAttendance(sessionId: string): Promise<readonly AttendanceRecord[]>;
  listStartedRounds(sessionId: string): Promise<readonly StartedRoundRecord[]>;
  getRound(roundId: string): Promise<RoundRecord | null>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]): Promise<void>;
  updateSession(session: SessionRecord): Promise<void>;
  saveAttendance(attendance: AttendanceRecord): Promise<void>;
  insertStartedRound(record: StartedRoundRecord): Promise<void>;
  updateMatch(match: MatchRecord): Promise<void>;
  updateRound(round: RoundRecord): Promise<void>;
  deleteRound(roundId: string): Promise<void>;
  listReplayMatches(groupId: string): Promise<readonly ReplayMatch[]>;
  replaceRatingState(
    groupId: string,
    players: readonly Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed">[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ): Promise<void>;
}
