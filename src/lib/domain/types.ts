import type { GeneratedRound, ScoreBreakdown } from "@/lib/matchmaking/types";

export interface GroupRecord {
  readonly id: string;
  readonly name: string;
  readonly organizerPinHash: string;
  readonly publicShareId: string;
  readonly createdAt: Date;
}

export interface PlayerRecord {
  readonly id: string;
  readonly groupId: string;
  readonly name: string;
  readonly initialRating: number;
  rating: number;
  ratedGamesPlayed: number;
  readonly active: boolean;
}

export interface SessionRecord {
  readonly id: string;
  readonly groupId: string;
  readonly courtCount: number;
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
