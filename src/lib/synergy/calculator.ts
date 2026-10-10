/**
 * Calculates synergy score (0 - 100%) using Bayesian Laplace smoothing.
 * Prior is 50% (1 win out of 2 pseudogames) to prevent volatility with small sample sizes.
 */
export function calculateSynergyScore(matchesPlayed: number, wins: number): number {
  if (matchesPlayed <= 0) return 50;
  const clampedWins = Math.max(0, Math.min(wins, matchesPlayed));
  const smoothed = (clampedWins + 1) / (matchesPlayed + 2);
  return Math.max(0, Math.min(100, Math.round(smoothed * 100)));
}
