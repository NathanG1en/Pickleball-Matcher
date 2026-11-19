import type {
  PlayerRatingUpdate,
  RatedMatchInput,
  RatedPlayer,
} from "@/lib/matchmaking/types";

export const K_MAX = 40;
export const K_MIN = 16; // Established-player baseline gives score-margin room to matter without overreacting
export const K_DECAY_RATE = 12; // Characteristic number of rated games for exponential K decay
export const INACTIVITY_GRACE_DAYS = 14; // Inactivity up to 14 days causes no increase in uncertainty
export const INACTIVITY_SCALE_DAYS = 30; // Characteristic timescale in days for uncertainty increase

// DUPR continuous performance point-share weight: 65% match outcome, 35% point share
export const POINT_SHARE_WEIGHT = 0.35;

// DUPR Zero-Change Deadband Filter: micro-adjustments < 0.5 Elo points (~0.00125 DUPR) result in exactly 0.000
export const ZERO_CHANGE_THRESHOLD = 0.5;

// Rating tier asymmetry boundaries
export const TIER_HIGH_RATING = 1400; // 4.5+ DUPR tier (deflation bias: wins reward less, losses hurt more)
export const TIER_LOW_RATING = 800; // <3.0 DUPR tier (upward mobility / learning curve bias)

// Backwards-compatible margin multiplier constants
export const BASE_MARGIN = 4;
export const BLOWOUT_MARGIN = 11;
export const MIN_MARGIN_MULTIPLIER = 0.75;
export const MAX_MARGIN_MULTIPLIER = 1.25;

export function teamRating(ratings: readonly [number, number]): number {
  return (ratings[0] + ratings[1]) / 2;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Calculates a player's K-factor based on experience (rated games played) and recency.
 * K decays gradually from K_MAX (40) toward K_MIN (16).
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
 * Calculates rating tier asymmetry modifier to mirror empirical DUPR tier drift.
 * - 4.5+ players face slight natural deflation (wins reward 10% less, losses penalize 10% more).
 * - <3.0 players experience upward learning-curve mobility (+8% on gains, -5% on losses).
 */
export function ratingTierModifier(rating: number, isGain: boolean): number {
  if (rating >= TIER_HIGH_RATING) {
    return isGain ? 0.90 : 1.10;
  }
  if (rating < TIER_LOW_RATING) {
    return isGain ? 1.08 : 0.95;
  }
  return 1.0;
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
  const logBaseline = Math.log(BASE_MARGIN + 2);
  const logBlowout = Math.log(BLOWOUT_MARGIN + 2);
  const rawMultiplier =
    1.0 +
    (MAX_MARGIN_MULTIPLIER - 1.0) *
      ((Math.log(margin + 2) - logBaseline) / (logBlowout - logBaseline));
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

/**
 * Calculates individual partner responsibility weights based on their individual expected scores (E_i)
 * against the opposing team rating.
 * - On team rating drops (losses), higher-rated partner had a higher expectation and absorbs more drop.
 * - On team rating gains (wins / spread beats), lower-rated partner faced a harder challenge and gets more gain.
 */
function teammateResponsibilityWeights(
  team: readonly [RatedPlayer, RatedPlayer],
  oppRating: number,
  isGain: boolean,
): readonly [number, number] {
  const e0 = expectedScore(team[0].rating, oppRating);
  const e1 = expectedScore(team[1].rating, oppRating);

  if (isGain) {
    const inv0 = 1 - e0;
    const inv1 = 1 - e1;
    const sum = inv0 + inv1;
    if (sum <= 0) return [0.5, 0.5];
    return [inv0 / sum, inv1 / sum];
  } else {
    const sum = e0 + e1;
    if (sum <= 0) return [0.5, 0.5];
    return [e0 / sum, e1 / sum];
  }
}

/**
 * Rates a doubles pickleball match using Recreational-Safe DUPR:
 * 1. Continuous Point Share Performance S* = (1 - β)*W + β*S_pts (enables underdog gains on loss).
 * 2. Recreational-Safe Winner Floor: Winners NEVER lose rating points (surprise clamped >= 0).
 * 3. Asymmetric Teammate Responsibility: Partners share delta proportionally to individual expectation E_i.
 * 4. Rating Tier Deflation/Inflation: 4.5+ deflation vs <3.0 upward learning mobility.
 * 5. Zero-Change Deadband Filter: Results falling within expected noise (< 0.5 Elo) result in 0.000 change.
 * 6. Experience & Inactivity K: Player-specific exponential K-decay (16-40) with hiatus responsiveness.
 */
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

  const w1 = winner === 1 ? 1 : 0;
  const w2 = 1 - w1;

  // Continuous point share performance S*
  let sStar1: number;
  let sStar2: number;
  if (scoresValid) {
    const s1 = input.team1Score!;
    const s2 = input.team2Score!;
    const totalPoints = s1 + s2;
    const sPts1 = totalPoints > 0 ? s1 / totalPoints : w1;
    const sPts2 = totalPoints > 0 ? s2 / totalPoints : w2;
    sStar1 = (1 - POINT_SHARE_WEIGHT) * w1 + POINT_SHARE_WEIGHT * sPts1;
    sStar2 = (1 - POINT_SHARE_WEIGHT) * w2 + POINT_SHARE_WEIGHT * sPts2;
  } else {
    sStar1 = w1;
    sStar2 = w2;
  }

  const rawSurprise1 = sStar1 - expectedTeam1;
  const rawSurprise2 = sStar2 - expectedTeam2;

  // Recreational-Safe Floor: Winners never lose rating points (surprise clamped >= 0)
  const surprise1 = w1 === 1 ? Math.max(0, rawSurprise1) : rawSurprise1;
  const surprise2 = w2 === 1 ? Math.max(0, rawSurprise2) : rawSurprise2;

  // Partner responsibility weights
  const weightsTeam1 = teammateResponsibilityWeights(input.team1, team2Rating, surprise1 >= 0);
  const weightsTeam2 = teammateResponsibilityWeights(input.team2, team1Rating, surprise2 >= 0);

  const updatePlayer = (
    player: RatedPlayer,
    surprise: number,
    weight: number,
    isWinner: boolean,
  ): PlayerRatingUpdate => {
    const daysInactive = resolvePlayerDaysInactive(player, input.completedAt);
    const baseK = kFactor(player.ratedGames, { daysInactive });
    const isGain = surprise >= 0;
    const tierMod = ratingTierModifier(player.rating, isGain);
    const effectiveK = baseK * tierMod;

    // Asymmetric partner responsibility scale (2 * weight = 1 when partners are equal)
    const rawDelta = effectiveK * surprise * (2 * weight);

    // Deadband filter: changes smaller than ZERO_CHANGE_THRESHOLD result in exactly 0.000 change
    let finalDelta = Math.abs(rawDelta) < ZERO_CHANGE_THRESHOLD ? 0.0 : rawDelta;

    // Recreational-safe guarantee: winning team players never lose rating
    if (isWinner && finalDelta < 0) {
      finalDelta = 0.0;
    }

    return {
      playerId: player.id,
      ratingBefore: player.rating,
      ratingAfter: player.rating + finalDelta,
      delta: finalDelta,
    };
  };

  return [
    updatePlayer(input.team1[0], surprise1, weightsTeam1[0], winner === 1),
    updatePlayer(input.team1[1], surprise1, weightsTeam1[1], winner === 1),
    updatePlayer(input.team2[0], surprise2, weightsTeam2[0], winner === 2),
    updatePlayer(input.team2[1], surprise2, weightsTeam2[1], winner === 2),
  ];
}
