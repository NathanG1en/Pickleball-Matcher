import type {
  AttendanceRecord,
  EmailVerificationTokenRecord,
  PartnerRequestRecord,
  PasswordResetTokenRecord,
  GroupRecord,
  GroupOrganizerPermissions,
  GroupOrganizerRecord,
  PublicGroupRecord,
  MatchPlayerRecord,
  MatchRecord,
  MatchResultContext,
  OAuthAccountRecord,
  PlayerRecord,
  PlayerAccountRecord,
  PlayerGender,
  ProfileVisibilitySettings,
  PlayerSessionHistoryRecord,
  PlayerSynergyRecord,
  PairMatchSynergyResult,
  RatingSnapshot,
  ReplayMatch,
  RoundRecord,
  RoundCompletionContext,
  SessionRecord,
  StartedRoundRecord,
  TournamentRecord,
  ChallengeTemplateRecord,
  GroupTrainingPlanRecord,
  GroupTrainingPlanItemRecord,
  PersonalTrainingPlanRecord,
  PersonalTrainingPlanItemRecord,
  TrainingResultRecord,
  TrainingResultParticipantRecord,
  TrainingProgressSummary,
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
  getPlayerAccountByEmail(email: string): Promise<PlayerAccountRecord | null>;
  createPlayerAccount(account: PlayerAccountRecord): Promise<void>;
  updatePlayerAccountName(accountId: string, name: string): Promise<void>;
  updatePlayerAccountUsername(accountId: string, username: string): Promise<void>;
  updatePlayerAccountGender(accountId: string, gender: PlayerGender): Promise<void>;
  updatePlayerAccountEmail(accountId: string, email: string | null, emailVerified: boolean): Promise<void>;
  updatePlayerAccountPassword(accountId: string, passwordHash: string): Promise<void>;
  createPasswordResetToken(token: PasswordResetTokenRecord): Promise<void>;
  getPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  deletePasswordResetToken(id: string): Promise<void>;
  deletePasswordResetTokensForAccount(accountId: string): Promise<void>;
  createEmailVerificationToken(token: EmailVerificationTokenRecord): Promise<void>;
  getEmailVerificationToken(tokenHash: string): Promise<EmailVerificationTokenRecord | null>;
  deleteEmailVerificationToken(id: string): Promise<void>;
  deleteEmailVerificationTokensForAccount(accountId: string): Promise<void>;
  createOAuthAccount(account: OAuthAccountRecord): Promise<void>;
  getOAuthAccount(provider: string, providerUserId: string): Promise<OAuthAccountRecord | null>;
  listOAuthAccountsForPlayer(accountId: string): Promise<readonly OAuthAccountRecord[]>;
  updatePlayerPrivacy(accountId: string, isPublic: boolean, visibilitySettings?: ProfileVisibilitySettings): Promise<void>;
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
  updateGroupOrganizerPermissions(groupId: string, permissions: GroupOrganizerPermissions): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  listPlayerSessionHistory(accountId: string): Promise<readonly PlayerSessionHistoryRecord[]>;
  insertGroup(group: GroupRecord): Promise<void>;
  lockPartnerRequests(sessionId: string): Promise<void>;
  listPartnerRequests(sessionId: string): Promise<readonly PartnerRequestRecord[]>;
  getPartnerRequest(requestId: string): Promise<PartnerRequestRecord | null>;
  insertPartnerRequest(request: PartnerRequestRecord): Promise<void>;
  updatePartnerRequest(request: PartnerRequestRecord): Promise<void>;
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
  getRoundCompletionContext(roundId: string): Promise<RoundCompletionContext | null>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  getMatchResultContexts(matchIds: readonly string[]): Promise<readonly MatchResultContext[]>;
  insertSession(session: SessionRecord, attendance: readonly AttendanceRecord[]): Promise<void>;
  updateSession(session: SessionRecord): Promise<void>;
  saveAttendance(attendance: AttendanceRecord): Promise<void>;
  insertStartedRound(record: StartedRoundRecord): Promise<void>;
  insertMatch(match: MatchRecord, matchPlayers: readonly MatchPlayerRecord[]): Promise<void>;
  updateMatch(match: MatchRecord): Promise<void>;
  /** Update all matches in a transaction; any conflict must abort that transaction. */
  updateMatches(matches: readonly MatchRecord[]): Promise<void>;
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
  listChallengeTemplates(groupId?: string): Promise<readonly ChallengeTemplateRecord[]>;
  getChallengeTemplate(id: string): Promise<ChallengeTemplateRecord | null>;
  getWeeklyTrainingPlan(groupId: string, year: number, weekNumber: number): Promise<{ plan: GroupTrainingPlanRecord; items: readonly GroupTrainingPlanItemRecord[] } | null>;
  listActiveGroupTrainingPlans(groupIds: readonly string[]): Promise<readonly { plan: GroupTrainingPlanRecord; groupName: string; challengeCount: number; completedCount: number }[]>;
  createWeeklyTrainingPlan(plan: GroupTrainingPlanRecord, items: readonly GroupTrainingPlanItemRecord[]): Promise<void>;
  recordTrainingResult(result: TrainingResultRecord, participants: readonly TrainingResultParticipantRecord[]): Promise<void>;
  listTrainingResultsForChallenge(challengeId: string, options?: { accountId?: string; playerId?: string; groupId?: string; limit?: number }): Promise<readonly TrainingResultRecord[]>;
  listTrainingResultsForPlan(planId: string): Promise<readonly TrainingResultRecord[]>;
  getPlayerPersonalBests(accountId?: string, playerId?: string): Promise<ReadonlyMap<string, number>>;
  getPlayerTrainingProgress(accountId?: string, playerId?: string): Promise<TrainingProgressSummary>;
  getPersonalWeeklyTrainingPlan(accountId: string, year: number, weekNumber: number): Promise<{ plan: PersonalTrainingPlanRecord; items: readonly PersonalTrainingPlanItemRecord[] } | null>;
  savePersonalWeeklyTrainingPlan(plan: PersonalTrainingPlanRecord, items: readonly PersonalTrainingPlanItemRecord[]): Promise<void>;
  listTrainingResultsForPersonalPlan(planId: string): Promise<readonly TrainingResultRecord[]>;
  deleteTrainingResult(resultId: string, actorId: string): Promise<boolean>;
}

