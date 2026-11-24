export interface GameParticipantScore {
  readonly team1PlayerIds: readonly string[];
  readonly team2PlayerIds: readonly string[];
  readonly team1Score: number | null;
  readonly team2Score: number | null;
}

export interface ExistingGameCandidate extends GameParticipantScore {
  readonly id: string;
  readonly gameNumber: number;
  readonly completedAt?: Date | null;
}

export interface PotentialDuplicatePair {
  readonly matchId: string;
  readonly duplicateOfGameNumber: number;
  readonly otherMatchId: string;
}

/**
 * Checks whether two games are potential duplicates.
 * Games are considered duplicates if they have the exact same players on both teams
 * (regardless of player ordering within each team) and identical scores, either directly
 * or with teams and scores inverted (e.g. Team A 11 - Team B 9 vs Team B 9 - Team A 11).
 */
export function areGamesDuplicate(
  a: GameParticipantScore,
  b: GameParticipantScore
): boolean {
  if (
    a.team1Score === null ||
    a.team2Score === null ||
    b.team1Score === null ||
    b.team2Score === null
  ) {
    return false;
  }

  const aT1 = [...a.team1PlayerIds].sort();
  const aT2 = [...a.team2PlayerIds].sort();
  const bT1 = [...b.team1PlayerIds].sort();
  const bT2 = [...b.team2PlayerIds].sort();

  const sameLengthsDirect = aT1.length === bT1.length && aT2.length === bT2.length;
  const sameLengthsSwapped = aT1.length === bT2.length && aT2.length === bT1.length;

  if (!sameLengthsDirect && !sameLengthsSwapped) {
    return false;
  }

  const direct =
    sameLengthsDirect &&
    aT1.every((id, i) => id === bT1[i]) &&
    aT2.every((id, i) => id === bT2[i]) &&
    a.team1Score === b.team1Score &&
    a.team2Score === b.team2Score;

  if (direct) {
    return true;
  }

  const swapped =
    sameLengthsSwapped &&
    aT1.every((id, i) => id === bT2[i]) &&
    aT2.every((id, i) => id === bT1[i]) &&
    a.team1Score === b.team2Score &&
    a.team2Score === b.team1Score;

  return swapped;
}

/**
 * Detects pairs of potential duplicate matches within a list of session matches.
 * Returns a map of matchId -> PotentialDuplicatePair.
 */
export function detectDuplicateMatchPairs(
  matches: readonly ExistingGameCandidate[]
): Map<string, PotentialDuplicatePair> {
  const duplicateMap = new Map<string, PotentialDuplicatePair>();

  for (let i = 0; i < matches.length; i++) {
    const m1 = matches[i];
    for (let j = i + 1; j < matches.length; j++) {
      const m2 = matches[j];
      if (areGamesDuplicate(m1, m2)) {
        if (!duplicateMap.has(m1.id)) {
          duplicateMap.set(m1.id, {
            matchId: m1.id,
            duplicateOfGameNumber: m2.gameNumber,
            otherMatchId: m2.id,
          });
        }
        if (!duplicateMap.has(m2.id)) {
          duplicateMap.set(m2.id, {
            matchId: m2.id,
            duplicateOfGameNumber: m1.gameNumber,
            otherMatchId: m1.id,
          });
        }
      }
    }
  }

  return duplicateMap;
}

