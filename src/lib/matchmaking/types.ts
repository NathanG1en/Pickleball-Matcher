export type PlayerId = string;

export type Team = readonly [PlayerId, PlayerId] | readonly [PlayerId];

export interface MatchmakingPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly rating: number;
  readonly gamesPlayed: number;
  readonly eligibleRounds: number;
  readonly satPreviousRound: boolean;
}

export interface PairHistory {
  readonly player1Id: PlayerId;
  readonly player2Id: PlayerId;
  readonly sessionPartnerCount: number;
  readonly sessionOpponentCount: number;
  readonly roundsSincePartner: number | null;
  readonly roundsSinceOpponent: number | null;
  readonly lifetimePartnerCount: number;
  readonly lifetimeOpponentCount: number;
}

export interface CourtAssignment {
  readonly courtNumber: number;
  readonly team1: Team;
  readonly team2: Team;
  readonly matchType?: "doubles" | "singles";
}

export interface RoundCandidate {
  readonly courts: readonly CourtAssignment[];
  readonly sitting: readonly PlayerId[];
}

export interface ScoreBreakdown {
  readonly playingTime: number;
  readonly consecutiveSit: number;
  readonly partnerRepeat: number;
  readonly skillBalance: number;
  readonly opponentRepeat: number;
  readonly tieBreak: number;
  readonly total: number;
}

export interface GeneratedRound extends RoundCandidate {
  readonly seed: number;
  readonly score: number;
  readonly scoreBreakdown: ScoreBreakdown;
}

export interface GenerationError {
  readonly code: "INSUFFICIENT_PLAYERS" | "INVALID_COURT_COUNT";
  readonly message: string;
}

export type GenerationResult =
  | { readonly ok: true; readonly value: GeneratedRound }
  | { readonly ok: false; readonly error: GenerationError };

export interface RandomSource {
  next(): number;
  integer(maxExclusive: number): number;
  shuffle<T>(values: readonly T[]): T[];
}

export interface RatedPlayer {
  readonly id: PlayerId;
  readonly rating: number;
  readonly ratedGames: number;
}

export interface RatedMatchInput {
  readonly team1: readonly [RatedPlayer, RatedPlayer];
  readonly team2: readonly [RatedPlayer, RatedPlayer];
  readonly winner: 1 | 2;
}

export interface PlayerRatingUpdate {
  readonly playerId: PlayerId;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
}

export interface MatchmakingWeights {
  readonly consecutiveSit: number;
  readonly playingTime: number;
  readonly partnerRepeat: number;
  readonly skillBalance: number;
  readonly opponentRepeat: number;
}

export interface MatchmakingConfig {
  readonly iterations: number;
  readonly weights: MatchmakingWeights;
  readonly partnerRecency: Readonly<Record<number, number>>;
  readonly opponentRecency: Readonly<Record<number, number>>;
  readonly longTermPartnerFactor: number;
  readonly longTermOpponentFactor: number;
  readonly tieBreakMaximum: number;
}

export interface SittingPenalty {
  readonly playingTime: number;
  readonly consecutiveSit: number;
}

export interface RoundScoringContext {
  readonly players: readonly MatchmakingPlayer[];
  readonly pairHistory: readonly PairHistory[] | ReadonlyMap<string, PairHistory>;
  readonly config: MatchmakingConfig;
  readonly sittingPenalty: SittingPenalty;
  readonly tieBreak: number;
}

export interface SittingSelectionInput {
  readonly players: readonly MatchmakingPlayer[];
  readonly sitCount: number;
  readonly random: RandomSource;
  readonly config: MatchmakingConfig;
}

export interface SittingChoiceInput {
  readonly players: readonly MatchmakingPlayer[];
  readonly sitting: readonly PlayerId[];
}

export interface GenerateRoundInput {
  readonly players: readonly MatchmakingPlayer[];
  readonly courts: number;
  readonly pairHistory: readonly PairHistory[];
  readonly config?: MatchmakingConfig;
  readonly seed?: number;
  readonly allowSingles?: boolean;
}
