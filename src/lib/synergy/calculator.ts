/**
 * Calculates expectation-adjusted partner synergy score.
 *
 * Methodology & Parameters (from simulation findings):
 * - Evaluates performance against pre-match Elo expected win probability.
 * - Blends 90% match result residual (win - E) and 10% normalized score margin residual.
 * - Recency weighted with a 6-game half-life (lambda = 2^(-1/6)).
 * - Prior shrinkage parameter = 12 games to prevent lucky early streaks.
 * - Zero-centered signed index (positive = chemistry above expectations, negative = underperforming).
 */

export const HALF_LIFE = 6;
export const LAMBDA = Math.pow(2, -1 / HALF_LIFE);
export const LAMBDA_SQ = Math.pow(2, -2 / HALF_LIFE);
export const PRIOR = 12;
export const MARGIN_SCALE = 1.824435;
export const RESULT_WEIGHT = 0.9;
export const MARGIN_WEIGHT = 0.1;

// Precomputed table of expected normalized margins (t=11, win by 2) for p in [0.00, 1.00] step 0.01
const EXPECTED_MARGIN_TABLE: readonly number[] = [
  -0.9998, -0.4900, -0.4424, -0.4109, -0.3865, -0.3663, -0.3487, -0.3331, -0.3188, -0.3057,
  -0.2935, -0.2821, -0.2712, -0.2609, -0.2510, -0.2416, -0.2324, -0.2236, -0.2150, -0.2067,
  -0.1986, -0.1906, -0.1829, -0.1753, -0.1679, -0.1606, -0.1534, -0.1463, -0.1393, -0.1325,
  -0.1257, -0.1190, -0.1123, -0.1058, -0.0992, -0.0928, -0.0864, -0.0800, -0.0737, -0.0675,
  -0.0612, -0.0550, -0.0488, -0.0427, -0.0365, -0.0304, -0.0243, -0.0182, -0.0121, -0.0061,
   0.0000,
   0.0061,  0.0121,  0.0182,  0.0243,  0.0304,  0.0365,  0.0427,  0.0488,  0.0550,  0.0612,
   0.0675,  0.0737,  0.0800,  0.0864,  0.0928,  0.0992,  0.1058,  0.1123,  0.1190,  0.1257,
   0.1325,  0.1393,  0.1463,  0.1534,  0.1606,  0.1679,  0.1753,  0.1829,  0.1906,  0.1986,
   0.2067,  0.2150,  0.2236,  0.2324,  0.2416,  0.2510,  0.2609,  0.2712,  0.2821,  0.2935,
   0.3057,  0.3188,  0.3331,  0.3487,  0.3663,  0.3865,  0.4109,  0.4424,  0.4900,  0.9767
];

export function getExpectedNormalizedMargin(expectedWinProbability: number): number {
  const clamped = Math.max(0, Math.min(1, expectedWinProbability));
  const pos = clamped * 100;
  const idx = Math.floor(pos);
  const frac = pos - idx;
  if (idx >= 100) return EXPECTED_MARGIN_TABLE[100];
  return EXPECTED_MARGIN_TABLE[idx] + frac * (EXPECTED_MARGIN_TABLE[idx + 1] - EXPECTED_MARGIN_TABLE[idx]);
}

export interface MatchContributionInput {
  readonly won: boolean;
  readonly expectedWinProbability?: number | null;
  readonly ownScore?: number | null;
  readonly opponentScore?: number | null;
}

export function calculateMatchContribution(input: MatchContributionInput): number {
  const p = Math.max(0.01, Math.min(0.99, input.expectedWinProbability ?? 0.5));
  const y = input.won ? 1.0 : 0.0;
  const residual = y - p;

  if (
    input.ownScore !== null &&
    input.ownScore !== undefined &&
    input.opponentScore !== null &&
    input.opponentScore !== undefined &&
    input.ownScore + input.opponentScore > 0
  ) {
    const margin = (input.ownScore - input.opponentScore) / (input.ownScore + input.opponentScore);
    const expectedMargin = getExpectedNormalizedMargin(p);
    const marginResidual = MARGIN_SCALE * (margin - expectedMargin);
    return RESULT_WEIGHT * residual + MARGIN_WEIGHT * marginResidual;
  }

  return residual;
}

export interface SynergyState {
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly weightSum: number;
  readonly contributionSum: number;
  readonly weightSqSum: number;
}

export function updateSynergyState(
  previous: Partial<SynergyState> | null | undefined,
  input: MatchContributionInput
): SynergyState & { synergyScore: number } {
  const x = calculateMatchContribution(input);
  const prevW = previous?.weightSum ?? 0;
  const prevC = previous?.contributionSum ?? 0;
  const prevV = previous?.weightSqSum ?? 0;

  const weightSum = 1.0 + LAMBDA * prevW;
  const contributionSum = x + LAMBDA * prevC;
  const weightSqSum = 1.0 + LAMBDA_SQ * prevV;
  const matchesPlayed = (previous?.matchesPlayed ?? 0) + 1;
  const wins = (previous?.wins ?? 0) + (input.won ? 1 : 0);

  const neff = (weightSum * weightSum) / weightSqSum;
  const weightedMean = contributionSum / weightSum;
  const synergyScore = Math.max(-100, Math.min(100, Math.round(100 * weightedMean * (neff / (neff + PRIOR)))));

  return {
    matchesPlayed,
    wins,
    weightSum,
    contributionSum,
    weightSqSum,
    synergyScore,
  };
}

/**
 * Calculates synergy score for backward compatibility or direct single/batch calculation.
 */
export function calculateSynergyScore(
  matchesPlayed: number,
  wins: number,
  options?: MatchContributionInput
): number {
  if (matchesPlayed <= 0) return 0;
  let state: SynergyState & { synergyScore: number } = {
    matchesPlayed: 0,
    wins: 0,
    weightSum: 0,
    contributionSum: 0,
    weightSqSum: 0,
    synergyScore: 0,
  };

  const clampedWins = Math.max(0, Math.min(wins, matchesPlayed));

  // Interleave wins and losses for representative baseline state if history not provided
  for (let i = 0; i < matchesPlayed; i++) {
    const isWin = i < clampedWins;
    state = updateSynergyState(state, {
      won: isWin,
      expectedWinProbability: options?.expectedWinProbability ?? 0.5,
      ownScore: options?.ownScore,
      opponentScore: options?.opponentScore,
    });
  }

  return state.synergyScore;
}
