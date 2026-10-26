import type {
  AttendanceRecord,
  GroupRecord,
  GroupOrganizerRecord,
  PublicGroupRecord,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  PlayerAccountRecord,
  PlayerGender,
  PlayerSessionHistoryRecord,
  PlayerSynergyRecord,
  PairMatchSynergyResult,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  SessionRecord,
  StartedRoundRecord,
  TournamentRecord,
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
  transferGroupHost(groupId: string, newHostAccountId: string): Promise<void>;
  getPlayerAccount(accountId: string): Promise<PlayerAccountRecord | null>;
  getPlayerAccountByUsername(username: string): Promise<PlayerAccountRecord | null>;
  createPlayerAccount(account: PlayerAccountRecord): Promise<void>;
  updatePlayerAccountName(accountId: string, name: string): Promise<void>;
  updatePlayerAccountUsername(accountId: string, username: string): Promise<void>;
  updatePlayerAccountGender(accountId: string, gender: PlayerGender): Promise<void>;
  updatePlayerPrivacy(accountId: string, isPublic: boolean): Promise<void>;
  listPairSynergies(accountIds: readonly string[]): Promise<readonly PlayerSynergyRecord[]>;
  getPairSynergy(accountIdA: string, accountIdB: string): Promise<PlayerSynergyRecord | null>;
  getBestPartner(accountId: string): Promise<{ partnerAccountId: string; username: string; synergyScore: number; matchesPlayed: number } | null>;
  recordMatchesSynergy(pairResults: readonly PairMatchSynergyResult[]): Promise<void>;
  /** Acquire before result/session mutations and rating writes to serialize chemistry writers. */
  lockSynergyState(): Promise<void>;
  replaceSynergyState(records: readonly PlayerSynergyRecord[]): Promise<void>;
  searchPlayerAccounts(query: string, limit?: number): Promise<readonly PlayerAccountRecord[]>;
  listPlayerAccounts(search?: string, limit?: number): Promise<readonly PlayerAccountRecord[]>;
  addPlayerToGroup(accountId: string, groupId: string): Promise<PlayerRecord | null>;
  linkGuestPlayer(groupId: string, playerId: string, accountId: string): Promise<PlayerRecord | null>;
  joinPublicGroup(accountId: string, groupId: string): Promise<PlayerRecord | null>;
  leavePublicGroup(accountId: string, groupId: string): Promise<boolean>;
  updateGroupVisibility(groupId: string, isPublic: boolean): Promise<void>;
  updateGroupName(groupId: string, name: string): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]>;
  insertGroup(group: GroupRecord): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  listSessions(groupId: string): Promise<readonly SessionRecord[]>;
  updateSessionName(sessionId: string, name: string): Promise<void>;
  deleteSession(sessionId: string, groupId: string): Promise<void>;
  listPlayers(groupId?: string, options?: { includeInactive?: boolean }): Promise<readonly PlayerRecord[]>;
  createPlayer(player: PlayerRecord): Promise<void>;
  updatePlayer(player: Partial<PlayerRecord> & { id: string; groupId: string }): Promise<void>;
  deletePlayer(playerId: string, groupId: string): Promise<void>;
  removePlayerFromGroup(playerId: string, groupId: string): Promise<boolean>;
  mergeGuestPlayers(
    groupId: string,
    targetPlayerId: string,
    sourcePlayerIds: readonly string[],
    mergedName: string,
  ): Promise<PlayerRecord>;
  listAttendance(sessionId: string): Promise<readonly AttendanceRecord[]>;
  listStartedRounds(sessionId: string): Promise<readonly StartedRoundRecord[]>;
  getRound(roundId: string): Promise<RoundRecord | null>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]): Promise<void>;
  updateSession(session: SessionRecord): Promise<void>;
  saveAttendance(attendance: AttendanceRecord): Promise<void>;
  insertStartedRound(record: StartedRoundRecord): Promise<void>;
  insertMatch(match: MatchRecord, matchPlayers: readonly MatchPlayerRecord[]): Promise<void>;
  updateMatch(match: MatchRecord): Promise<void>;
  updateMatchPlayers(matchId: string, matchPlayers: readonly MatchPlayerRecord[]): Promise<void>;
  deleteMatch(matchId: string): Promise<void>;
  updateRound(round: RoundRecord): Promise<void>;
  deleteRound(roundId: string): Promise<void>;
  listReplayMatches(groupId?: string): Promise<readonly ReplayMatch[]>;
  replaceRatingState(
    groupId: string,
    players: readonly (Pick<PlayerRecord, "id" | "rating" | "ratedGamesPlayed"> & { accountId?: string | null })[],
    snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
  ): Promise<void>;
  getTournament(tournamentId: string): Promise<TournamentRecord | null>;
  listTournaments(groupId: string): Promise<readonly TournamentRecord[]>;
  createTournament(tournament: TournamentRecord): Promise<void>;
  updateTournament(tournament: TournamentRecord): Promise<void>;
  deleteTournament(tournamentId: string, groupId: string): Promise<void>;
}

