import type { GeneratedRound, ScoreBreakdown } from "@/lib/matchmaking/types";

export interface GroupRecord {
  readonly id: string;
  readonly name: string;
  readonly organizerPinHash: string;
  readonly createdAt: Date;
  readonly isPublic?: boolean;
  readonly ownerAccountId?: string | null;
}

export type PlayerSkillLevel = "beginner" | "intermediate" | "advanced";
export type PlayerGender = "male" | "female";

export interface PlayerAccountRecord {
  readonly id: string;
  readonly username: string;
  name: string;
  gender?: PlayerGender;
  readonly isPublic?: boolean;
  readonly passwordHash: string;
  readonly skillLevel: PlayerSkillLevel;
  readonly initialRating: number;
  readonly createdAt: Date;
}

export interface PlayerSynergyRecord {
  readonly accountId1: string;
  readonly accountId2: string;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly synergyScore: number;
  readonly updatedAt: Date;
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
}

export interface PlayerSessionHistoryRecord {
  readonly sessionId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly startedAt: Date;
  readonly wins: number;
  readonly losses: number;
  readonly rating: number;
}

export interface SessionRecord {
  readonly id: string;
  readonly groupId: string;
  readonly courtCount: number;
  readonly courtPlayerCounts?: readonly (2 | 3 | 4)[];
  status: "active" | "completed";
  currentRoundNumber: number;
  readonly startedAt: Date;
  endedAt: Date | null;
  version: number;
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

export interface ReplayMatch {
  readonly id: string;
  readonly groupId: string;
  readonly status: "completed" | "cancelled";
  readonly completedAt: Date;
  readonly team1: readonly [string, string];
  readonly team2: readonly [string, string];
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

export interface RecordResultInput {
  readonly matchId: string;
  readonly team1Score: number;
  readonly team2Score: number;
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

export interface TournamentRecord {
  readonly id: string;
  readonly groupId: string;
  name: string;
  status: "draft" | "active" | "completed";
  divisions: readonly TournamentDivision[];
  brackets: Record<string, TournamentBracket>;
  readonly createdAt: Date;
  updatedAt: Date;
}

