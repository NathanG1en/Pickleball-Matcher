import type { StayTogetherPair } from "@/lib/matchmaking/types";
import type { GeneratedRound, ScoreBreakdown } from "@/lib/matchmaking/types";

export type GroupOrganizerPermissionKey =
  | "edit_group_name"
  | "edit_group_privacy"
  | "manage_organizers"
  | "delete_group";

export interface GroupOrganizerPermissions {
  readonly edit_group_name: boolean;
  readonly edit_group_privacy: boolean;
  readonly manage_organizers: boolean;
  readonly delete_group: boolean;
}

export const DEFAULT_GROUP_ORGANIZER_PERMISSIONS: GroupOrganizerPermissions = {
  edit_group_name: true,
  edit_group_privacy: true,
  manage_organizers: false,
  delete_group: false,
};

export interface GroupRecord {
  readonly id: string;
  readonly name: string;
  readonly organizerPinHash: string;
  readonly createdAt: Date;
  readonly isPublic?: boolean;
  readonly ownerAccountId?: string | null;
  readonly organizerPermissions?: GroupOrganizerPermissions;
}

export type PlayerSkillLevel = "beginner" | "intermediate" | "advanced";
export type PlayerGender = "male" | "female";

export type ProfileVisibilityLevel = "everyone" | "group_members" | "only_you";

export interface ProfileVisibilitySettings {
  readonly profile: ProfileVisibilityLevel;
  readonly activities: ProfileVisibilityLevel;
  readonly ratingStats: ProfileVisibilityLevel;
  readonly chemistry: ProfileVisibilityLevel;
  readonly groups: ProfileVisibilityLevel;
}

export const DEFAULT_PROFILE_VISIBILITY_SETTINGS: ProfileVisibilitySettings = {
  profile: "everyone",
  activities: "everyone",
  ratingStats: "everyone",
  chemistry: "everyone",
  groups: "everyone",
};

export interface PlayerAccountRecord {
  readonly id: string;
  readonly username: string;
  name: string;
  gender?: PlayerGender;
  readonly isPublic?: boolean;
  readonly visibilitySettings?: ProfileVisibilitySettings;
  readonly passwordHash?: string | null;
  readonly skillLevel: PlayerSkillLevel;
  readonly initialRating: number;
  rating?: number;
  ratedGamesPlayed?: number;
  email?: string | null;
  emailVerified?: boolean;
  readonly createdAt: Date;
}

export interface OAuthAccountRecord {
  readonly id: string;
  readonly accountId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly email?: string | null;
  readonly createdAt: Date;
}

export interface PasswordResetTokenRecord {
  readonly id: string;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface EmailVerificationTokenRecord {
  readonly id: string;
  readonly accountId: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface PlayerSynergyRecord {
  readonly accountId1: string;
  readonly accountId2: string;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly synergyScore: number;
  readonly weightSum?: number;
  readonly contributionSum?: number;
  readonly weightSqSum?: number;
  readonly updatedAt: Date;
}

export interface PairMatchSynergyResult {
  readonly accountIdA: string;
  readonly accountIdB: string;
  readonly won: boolean;
  readonly expectedWinProbability?: number;
  readonly ownScore?: number | null;
  readonly opponentScore?: number | null;
}

export interface PublicGroupRecord {
  readonly id: string;
  readonly name: string;
  readonly playerCount: number;
  readonly isMember?: boolean;
  readonly isHost?: boolean;
  readonly isOrganizer?: boolean;
}

export interface GroupOrganizerRecord {
  readonly accountId: string;
  readonly username: string;
  readonly name: string;
  readonly isHost: boolean;
}

export interface PlayerRecord {
  readonly id: string;
  readonly groupId: string;
  readonly name: string;
  readonly initialRating: number;
  rating: number;
  ratedGamesPlayed: number;
  readonly active: boolean;
  readonly accountId?: string | null;
  readonly username?: string | null;
  gender?: PlayerGender | null;
  readonly isPublic?: boolean;
  readonly visibilitySettings?: ProfileVisibilitySettings;
}

export type SessionType = "regular" | "open_play";

export interface PlayerSessionHistoryRecord {
  readonly sessionId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly startedAt: Date;
  readonly wins: number;
  readonly losses: number;
  readonly rating: number;
  readonly type?: SessionType;
  readonly sessionName?: string | null;
}

export interface SessionRecord {
  readonly stayTogetherPairs?: readonly StayTogetherPair[];
  readonly id: string;
  readonly groupId: string;
  readonly courtCount: number;
  readonly courtPlayerCounts?: readonly (2 | 3 | 4)[];
  status: "active" | "completed";
  currentRoundNumber: number;
  readonly startedAt: Date;
  endedAt: Date | null;
  version: number;
  type?: SessionType;
  name?: string | null;
}

export interface PartnerRequestView {
  readonly session: SessionRecord;
  readonly requests: readonly PartnerRequestRecord[];
  readonly players: readonly { id: string; name: string }[];
  readonly presentPlayerIds: readonly string[];
}

export type PartnerRequestStatus = "pending" | "approved" | "declined" | "cancelled";
export interface PartnerRequestRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly requesterPlayerId: string;
  readonly partnerPlayerId: string;
  readonly status: PartnerRequestStatus;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
  readonly version: number;
}

export interface AttendanceRecord {
  readonly sessionId: string;
  readonly playerId: string;
  joinedRound: number;
  leftRound: number | null;
}

export interface RoundRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly roundNumber: number;
  status: "started" | "completed" | "cancelled";
  readonly seed: number;
  readonly scoreBreakdown: ScoreBreakdown;
  readonly createdAt: Date;
  readonly startedAt: Date;
  completedAt: Date | null;
  version: number;
}

/** Fresh completion input; resolved matches and unrelated round history are omitted. */
export interface RoundCompletionContext {
  readonly round: RoundRecord;
  readonly pendingMatches: readonly { readonly match: MatchRecord; readonly playerCount: number }[];
}

export interface MatchRecord {
  readonly id: string;
  readonly roundId: string;
  readonly courtNumber: number;
  readonly rated?: boolean;
  status: "pending" | "completed" | "cancelled";
  team1Score: number | null;
  team2Score: number | null;
  completedAt: Date | null;
  version: number;
}

export interface MatchPlayerRecord {
  readonly matchId: string;
  readonly playerId: string;
  readonly team: 1 | 2;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

/** Context needed to validate and save a batch without per-match parent reads. */
export interface MatchResultContext {
  readonly match: MatchRecord;
  readonly groupId: string;
  readonly sessionId: string;
  readonly roundStatus: RoundRecord["status"];
  readonly sessionStatus: SessionRecord["status"];
}

export interface RoundSitRecord {
  readonly roundId: string;
  readonly playerId: string;
}

export interface StartedRoundRecord {
  readonly round: RoundRecord;
  readonly matches: readonly MatchRecord[];
  readonly matchPlayers: readonly MatchPlayerRecord[];
  readonly sits: readonly RoundSitRecord[];
}

export type RoundProposal = GeneratedRound;

/** Server-loaded inputs for read-only proposal calculation within one request. */
export interface RoundProposalSnapshot {
  readonly session: SessionRecord;
  readonly players: readonly PlayerRecord[];
  readonly attendance: readonly AttendanceRecord[];
  readonly rounds: readonly StartedRoundRecord[];
}

export interface ReplayMatch {
  readonly id: string;
  readonly groupId: string;
  /** True only for finalized normal rounds or completed Open Play games. */
  readonly synergyEligible?: boolean;
  readonly status: "completed" | "cancelled";
  readonly completedAt: Date;
  readonly team1: readonly string[];
  readonly team2: readonly string[];
  readonly team1Score: number;
  readonly team2Score: number;
}

export interface RatingSnapshot {
  readonly playerId: string;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
}

export interface RatingReplayResult {
  readonly processedMatchIds: readonly string[];
  readonly playerRatings: ReadonlyMap<string, number>;
}

export interface SessionServiceDependencies {
  now(): Date;
  nextId(kind: "session" | "round" | "match"): string;
  nextSeed(): number;
}

export interface StartSessionInput {
  readonly stayTogetherPairs?: readonly StayTogetherPair[];
  readonly groupId: string;
  readonly courtCount: number;
  readonly playerIds: readonly string[];
  readonly courtPlayerCounts?: readonly (2 | 3 | 4)[];
}

export interface ChangeAttendanceInput {
  readonly sessionId: string;
  readonly playerId: string;
  readonly present: boolean;
}

export interface UpdateCourtConfigInput {
  readonly sessionId: string;
  readonly courtCount: number;
  readonly courtPlayerCounts?: readonly (2 | 3 | 4)[];
}

export interface RecordResultInput {
  readonly matchId: string;
  readonly team1Score: number;
  readonly team2Score: number;
}

export interface BatchRecordResultInput extends RecordResultInput {
  readonly matchVersion?: number;
}

export type TournamentDivision =
  | "mens_singles"
  | "womens_singles"
  | "mens_doubles"
  | "womens_doubles"
  | "mixed_doubles";

export const TOURNAMENT_DIVISIONS: readonly TournamentDivision[] = [
  "mens_singles",
  "womens_singles",
  "mens_doubles",
  "womens_doubles",
  "mixed_doubles",
] as const;

export const TOURNAMENT_DIVISION_LABELS: Record<TournamentDivision, string> = {
  mens_singles: "Men's Singles",
  womens_singles: "Women's Singles",
  mens_doubles: "Men's Doubles",
  womens_doubles: "Women's Doubles",
  mixed_doubles: "Mixed Doubles",
};

export const TOURNAMENT_DIVISION_DESCRIPTIONS: Record<TournamentDivision, string> = {
  mens_singles: "1v1 · Male players",
  womens_singles: "1v1 · Female players",
  mens_doubles: "2v2 · Male teams",
  womens_doubles: "2v2 · Female teams",
  mixed_doubles: "2v2 · 1 Male & 1 Female per team",
};

export interface TournamentParticipant {
  readonly id: string;
  name: string;
  playerIds: readonly string[];
  seed?: number;
}

export interface TournamentMatch {
  readonly id: string;
  readonly round: number;
  readonly matchNumber: number;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: "pending" | "in_progress" | "completed" | "bye";
  nextMatchId?: string | null;
  nextMatchSlot?: 1 | 2 | null;
}

export interface TournamentBracket {
  readonly division: TournamentDivision;
  participants: readonly TournamentParticipant[];
  matches: readonly TournamentMatch[];
  roundNames: readonly string[];
}

export type TournamentFormat = "bracket" | "team_dual";

export interface TeamTournamentPair {
  readonly id: string;
  readonly player1Id: string;
  readonly player2Id: string;
}

export interface TeamTournamentTeam {
  readonly id: string;
  name: string;
  color: string;
  pairIds: readonly string[];
  soloPlayerIds: readonly string[];
}

export interface TeamTournamentLine {
  readonly id: string;
  readonly lineNumber: number;
  name: string;
  type: "doubles" | "singles";
  team1PlayerIds: readonly string[];
  team2PlayerIds: readonly string[];
  team1Score: number | null;
  team2Score: number | null;
  status: "pending" | "in_progress" | "completed";
}

export interface TeamTournamentData {
  pairs: readonly TeamTournamentPair[];
  teams: readonly TeamTournamentTeam[];
  lines: readonly TeamTournamentLine[];
  format: "dual_meet";
  scoringType: "games_won" | "points_diff";
}

export type TournamentStatus = "draft" | "active" | "completed";

export interface TournamentRecord {
  readonly id: string;
  readonly groupId: string;
  name: string;
  status: TournamentStatus;
  divisions: readonly TournamentDivision[];
  brackets: Record<string, TournamentBracket>;
  readonly createdAt: Date;
  updatedAt: Date;
  format?: TournamentFormat;
  teamData?: TeamTournamentData | null;
}

export type ChallengeTrackingFormat =
  | "highest_score"
  | "accuracy"
  | "wins"
  | "completion"
  | "timed";

export type ChallengeParticipantFormat = "individual" | "partner" | "group";

export type ChallengeSkillCategory =
  | "dinking"
  | "third_shot"
  | "serving"
  | "volleys"
  | "resets"
  | "conditioning";

export interface ChallengeTemplateRecord {
  readonly id: string;
  readonly scope: "system" | "group";
  readonly groupId?: string | null;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly instructions: string;
  readonly skillCategory: ChallengeSkillCategory;
  readonly participantFormat: ChallengeParticipantFormat;
  readonly trackingFormat: ChallengeTrackingFormat;
  readonly scoreUnit: string;
  readonly higherIsBetter: boolean;
  readonly defaultTargetGoal?: number | null;
  readonly recommendedDurationMinutes?: number | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GroupTrainingPlanRecord {
  readonly id: string;
  readonly groupId: string;
  readonly year: number;
  readonly weekNumber: number;
  readonly title: string;
  readonly focusNotes?: string | null;
  readonly status: "draft" | "published" | "archived";
  readonly publishedAt?: Date | null;
  readonly createdByAccountId?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GroupTrainingPlanItemRecord {
  readonly id: string;
  readonly planId: string;
  readonly challengeId: string;
  readonly customGoalDescription?: string | null;
  readonly targetBenchmark?: number | null;
  readonly sortOrder: number;
  readonly challenge?: ChallengeTemplateRecord;
}

export interface PersonalTrainingPlanRecord {
  readonly id: string;
  readonly accountId: string;
  readonly year: number;
  readonly weekNumber: number;
  readonly title: string;
  readonly focusNotes?: string | null;
  readonly status: "active" | "completed" | "archived";
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PersonalTrainingPlanItemRecord {
  readonly id: string;
  readonly planId: string;
  readonly challengeId: string;
  readonly customGoalDescription?: string | null;
  readonly targetBenchmark?: number | null;
  readonly sortOrder: number;
  readonly challenge?: ChallengeTemplateRecord;
}

export interface TrainingResultRecord {
  readonly id: string;
  readonly accountId?: string | null;
  readonly groupId?: string | null;
  readonly planItemId?: string | null;
  readonly challengeId: string;
  readonly loggedByPlayerId?: string | null;
  readonly scorePrimary: number;
  readonly scoreSecondary?: number | null;
  readonly metricValue: number;
  readonly completed: boolean;
  readonly notes?: string | null;
  readonly recordedAt: Date;
  readonly version: number;
  readonly participants?: readonly TrainingResultParticipantRecord[];
}

export interface TrainingResultParticipantRecord {
  readonly id: string;
  readonly resultId: string;
  readonly playerId?: string | null;
  readonly accountId?: string | null;
  readonly role: "primary" | "partner" | "opponent" | "feeder" | "group_member";
  readonly playerName?: string;
  readonly playerUsername?: string;
}

export interface TrainingProgressSummary {
  readonly totalCompleted: number;
  readonly personalBestsCount: number;
  readonly totalImprovementPoints: number;
  readonly currentStreakDays: number;
}

