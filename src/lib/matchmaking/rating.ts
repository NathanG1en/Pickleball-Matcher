import type {
  PlayerRatingUpdate,
  RatedMatchInput,
  RatedPlayer,
} from "@/lib/matchmaking/types";

export const K_MAX = 40;
export const K_MIN = 20;
export const K_DECAY_RATE = 12; // Characteristic number of rated games for exponential K decay
export const INACTIVITY_GRACE_DAYS = 14; // Inactivity up to 14 days causes no increase in uncertainty
export const INACTIVITY_SCALE_DAYS = 30; // Characteristic timescale in days for uncertainty increase

export const BASE_MARGIN = 4; // Margin of 4 points (standard 11-7 game) serves as baseline multiplier 1.0
export const MIN_MARGIN_MULTIPLIER = 0.6; // Lower bound on margin multiplier for narrow wins (1-2 points)
export const MAX_MARGIN_MULTIPLIER = 1.6; // Upper bound on margin multiplier for blowouts (11+ points)

export function teamRating(ratings: readonly [number, number]): number {
  return (ratings[0] + ratings[1]) / 2;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Calculates a player's K-factor based on experience (rated games played) and recency.
 * K decays gradually from K_MAX (40) toward K_MIN (20).
 * Inactivity beyond INACTIVITY_GRACE_DAYS increases uncertainty/responsiveness,
 * smoothly scaling K back up toward K_MAX without altering the player's underlying rating.
 */
export function kFactor(
  ratedGames: number,
  options?: { daysInactive?: number | null } | number | null,
): number {
  const games = Math.max(0, ratedGames);
  const baseK = K_MIN + (K_MAX - K_MIN) * Math.exp(-games / K_DECAY_RATE);

  const rawDays = typeof options === "number" ? options : options?.daysInactive;
  const daysInactive = typeof rawDays === "number" && Number.isFinite(rawDays) ? Math.max(0, rawDays) : 0;

  if (daysInactive <= INACTIVITY_GRACE_DAYS) {
    return baseK;
  }

  const excessDays = daysInactive - INACTIVITY_GRACE_DAYS;
  const uncertaintyFactor = 1 - Math.exp(-excessDays / INACTIVITY_SCALE_DAYS);
  const effectiveK = baseK + (K_MAX - baseK) * uncertaintyFactor;

  return Math.min(K_MAX, Math.max(K_MIN, effectiveK));
}

/**
 * Calculates a bounded diminishing-returns multiplier based on the point margin of victory.
 * If scores are invalid, missing, or tied, returns 1.0.
 */
export function scoreMarginMultiplier(
  team1Score?: number | null,
  team2Score?: number | null,
): number {
  if (
    team1Score === undefined ||
    team1Score === null ||
    team2Score === undefined ||
    team2Score === null ||
    !Number.isSafeInteger(team1Score) ||
    !Number.isSafeInteger(team2Score) ||
    team1Score < 0 ||
    team2Score < 0 ||
    team1Score === team2Score
  ) {
    return 1.0;
  }

  const margin = Math.abs(team1Score - team2Score);
  const rawMultiplier = Math.log(margin + 2) / Math.log(BASE_MARGIN + 2);
  return Math.min(MAX_MARGIN_MULTIPLIER, Math.max(MIN_MARGIN_MULTIPLIER, rawMultiplier));
}

function resolvePlayerDaysInactive(
  player: RatedPlayer,
  matchCompletedAt?: Date | string | null,
): number {
  if (typeof player.daysInactive === "number" && Number.isFinite(player.daysInactive)) {
    return Math.max(0, player.daysInactive);
  }

  if (player.lastMatchAt && matchCompletedAt) {
    const matchTime = matchCompletedAt instanceof Date ? matchCompletedAt.getTime() : new Date(matchCompletedAt).getTime();
    const lastTime = player.lastMatchAt instanceof Date ? player.lastMatchAt.getTime() : new Date(player.lastMatchAt).getTime();
    if (Number.isFinite(matchTime) && Number.isFinite(lastTime)) {
      return Math.max(0, (matchTime - lastTime) / (1000 * 60 * 60 * 24));
    }
  }

  return 0;
}

export function rateMatch(input: RatedMatchInput): readonly PlayerRatingUpdate[] {
  const team1Rating = teamRating([input.team1[0].rating, input.team1[1].rating]);
  const team2Rating = teamRating([input.team2[0].rating, input.team2[1].rating]);
  const expectedTeam1 = expectedScore(team1Rating, team2Rating);
  const expectedTeam2 = 1 - expectedTeam1;

  // Determine winner consistently: valid scores take precedence; fallback to input.winner ?? 1
  let winner: 1 | 2;
  const scoresValid =
    input.team1Score !== undefined &&
    input.team1Score !== null &&
    input.team2Score !== undefined &&
    input.team2Score !== null &&
    Number.isSafeInteger(input.team1Score) &&
    Number.isSafeInteger(input.team2Score) &&
    input.team1Score >= 0 &&
    input.team2Score >= 0 &&
    input.team1Score !== input.team2Score;

  if (scoresValid) {
    winner = input.team1Score! > input.team2Score! ? 1 : 2;
  } else {
    winner = input.winner ?? 1;
  }

  const actualTeam1 = winner === 1 ? 1 : 0;
  const actualTeam2 = 1 - actualTeam1;
  const marginMultiplier = scoreMarginMultiplier(input.team1Score, input.team2Score);

  const updatePlayer = (
    player: RatedPlayer,
    actual: number,
    expected: number,
  ): PlayerRatingUpdate => {
    const daysInactive = resolvePlayerDaysInactive(player, input.completedAt);
    const k = kFactor(player.ratedGames, { daysInactive });
    const delta = k * (actual - expected) * marginMultiplier;
    return {
      playerId: player.id,
      ratingBefore: player.rating,
      ratingAfter: player.rating + delta,
      delta,
    };
  };

  return [
    updatePlayer(input.team1[0], actualTeam1, expectedTeam1),
    updatePlayer(input.team1[1], actualTeam1, expectedTeam1),
    updatePlayer(input.team2[0], actualTeam2, expectedTeam2),
    updatePlayer(input.team2[1], actualTeam2, expectedTeam2),
  ];
}
