import type {
  AttendanceRecord,
  GroupRecord,
  PublicGroupRecord,
  MatchRecord,
  PlayerRecord,
  PlayerAccountRecord,
  PlayerSessionHistoryRecord,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

export interface DomainRepository {
  transaction<T>(operation: (repository: DomainRepository) => Promise<T>): Promise<T>;
  getGroup(groupId: string): Promise<GroupRecord | null>;
  getGroupsByName(name: string): Promise<readonly GroupRecord[]>;
  getGroupByShareId(shareId: string): Promise<GroupRecord | null>;
  listPublicGroups(search: string, accountId?: string): Promise<readonly PublicGroupRecord[]>;
  getPlayerAccount(accountId: string): Promise<PlayerAccountRecord | null>;
  getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null>;
  createPlayerAccount(account: PlayerAccountRecord): Promise<void>;
  updatePlayerAccountName(accountId: string, name: string): Promise<void>;
  joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null>;
  leavePublicGroup(accountId: string, groupId: string): Promise<boolean>;
  updateGroupVisibility(groupId: string, isPublic: boolean): Promise<void>;
  listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]>;
  insertGroup(group: GroupRecord): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  listSessions(groupId: string): Promise<readonly SessionRecord[]>;
  listPlayers(groupId: string): Promise<readonly PlayerRecord[]>;
  createPlayer(player: PlayerRecord): Promise<void>;
  updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }): Promise<void>;
  deletePlayer(playerId: string, groupId: string): Promise<void>;
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
