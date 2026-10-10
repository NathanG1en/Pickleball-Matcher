import type {
  AttendanceRecord,
  GroupRecord,
  GroupOrganizerRecord,
  PublicGroupRecord,
  MatchRecord,
  PlayerRecord,
  PlayerAccountRecord,
  PlayerGender,
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
  listPublicGroups(search: string, accountId?: string): Promise<readonly PublicGroupRecord[]>;
  listAccountGroups(accountId: string): Promise<readonly PublicGroupRecord[]>;
  isGroupOrganizer(groupId: string, accountId: string): Promise<boolean>;
  addGroupOrganizer(groupId: string, accountId: string): Promise<void>;
  removeGroupOrganizer(groupId: string, accountId: string): Promise<void>;
  listGroupOrganizers(groupId: string): Promise<readonly GroupOrganizerRecord[]>;
  getPlayerAccount(accountId: string): Promise<PlayerAccountRecord | null>;
  getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null>;
  createPlayerAccount(account: PlayerAccountRecord): Promise<void>;
  updatePlayerAccountName(accountId: string, name: string): Promise<void>;
  updatePlayerAccountUsername(accountId: string, username: string): Promise<void>;
  updatePlayerAccountGender(accountId: string, gender: PlayerGender): Promise<void>;
  joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null>;
  leavePublicGroup(accountId: string, groupId: string): Promise<boolean>;
  updateGroupVisibility(groupId: string, isPublic: boolean): Promise<void>;
  updateGroupName(groupId: string, name: string): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]>;
  insertGroup(group: GroupRecord): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  listSessions(groupId: string): Promise<readonly SessionRecord[]>;
  listPlayers(groupId: string, options?: { includeInactive?: boolean }): Promise<readonly PlayerRecord[]>;
  createPlayer(player: PlayerRecord): Promise<void>;
  updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }): Promise<void>;
  deletePlayer(playerId: string, groupId: string): Promise<void>;
  removePlayerFromGroup(playerId: string, groupId: string): Promise<boolean>;
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
