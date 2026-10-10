export interface TemporaryPlayer {
  readonly id: string;
  readonly name: string;
  readonly rating: number;
}

export interface TemporaryCourt {
  readonly courtNumber: number;
  readonly team1: readonly string[];
  readonly team2: readonly string[];
  readonly team1Score: number | null;
  readonly team2Score: number | null;
}

export interface TemporaryRound {
  readonly roundNumber: number;
  readonly seed: number;
  readonly courts: readonly TemporaryCourt[];
  readonly sitting: readonly string[];
}

export interface TemporaryGroupState {
  readonly name: string;
  readonly isPublic: boolean;
  readonly courtPlayerCounts: readonly (2 | 3 | 4)[];
  readonly players: readonly TemporaryPlayer[];
  readonly rounds: readonly TemporaryRound[];
  readonly currentRound: TemporaryRound | null;
}
