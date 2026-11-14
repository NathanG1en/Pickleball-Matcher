import type {
  PlayerRecord,
  TournamentBracket,
  TournamentDivision,
  TournamentMatch,
  TournamentParticipant,
} from "@/lib/domain/types";

/**
 * Randomly shuffles an array in place (Fisher-Yates) or returns a new shuffled array.
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

/**
 * Computes round names based on the total number of rounds.
 * e.g., 1 round -> ["Finals"]
 *       2 rounds -> ["Semifinals", "Finals"]
 *       3 rounds -> ["Quarterfinals", "Semifinals", "Finals"]
 *       4 rounds -> ["Round of 16", "Quarterfinals", "Semifinals", "Finals"]
 */
export function getRoundNames(totalRounds: number): string[] {
  const names: string[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const fromEnd = totalRounds - r;
    if (fromEnd === 0) {
      names.push("Finals");
    } else if (fromEnd === 1) {
      names.push("Semifinals");
    } else if (fromEnd === 2) {
      names.push("Quarterfinals");
    } else {
      names.push(`Round of ${Math.pow(2, fromEnd + 1)}`);
    }
  }
  return names;
}

/**
 * Pairs players into participants for a tournament division.
 */
function pairIntoTeams(players: readonly PlayerRecord[]): TournamentParticipant[] {
  const shuffled = shuffleArray(players);
  const teams: TournamentParticipant[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i]!;
    const p2 = shuffled[i + 1];
    teams.push(
      p2
        ? { id: `team_${p1.id}_${p2.id}`, name: `${p1.name} & ${p2.name}`, playerIds: [p1.id, p2.id], seed: teams.length + 1 }
        : { id: p1.id, name: p1.name, playerIds: [p1.id], seed: teams.length + 1 },
    );
  }
  return teams;
}

/**
 * Entrants for one division. Gendered divisions only ever contain players of that
 * gender, and mixed doubles only pairs a man with a woman: a division without
 * enough eligible players comes back short (or empty) rather than borrowing
 * players from the rest of the roster. Players with no gender set are left out
 * of all three gendered formats until the organizer sets one.
 */
export function createParticipantsForDivision(
  division: TournamentDivision,
  players: readonly PlayerRecord[],
): TournamentParticipant[] {
  const men = players.filter((p) => p.gender === "male");
  const women = players.filter((p) => p.gender === "female");

  switch (division) {
    case "mens_singles":
    case "womens_singles":
      return (division === "mens_singles" ? men : women).map((p, idx) => ({
        id: p.id,
        name: p.name,
        playerIds: [p.id],
        seed: idx + 1,
      }));
    case "mens_doubles":
      return pairIntoTeams(men);
    case "womens_doubles":
      return pairIntoTeams(women);
    case "mixed_doubles": {
      const shuffledMen = shuffleArray(men);
      const shuffledWomen = shuffleArray(women);
      const pairs = Math.min(shuffledMen.length, shuffledWomen.length);
      return Array.from({ length: pairs }, (_, i) => {
        const m = shuffledMen[i]!;
        const f = shuffledWomen[i]!;
        return { id: `team_${m.id}_${f.id}`, name: `${m.name} & ${f.name}`, playerIds: [m.id, f.id], seed: i + 1 };
      });
    }
    default:
      return [];
  }
}

/** Fewest entrants a division needs before a bracket makes sense. */
export const MIN_DIVISION_ENTRANTS = 2;

/**
 * Generates single-elimination bracket with randomized matchups and automatic byes.
 */
export function generateBracket(
  division: TournamentDivision,
  participants: readonly TournamentParticipant[],
  options?: { randomize?: boolean },
): TournamentBracket {
  const n = participants.length;
  if (n === 0) {
    return {
      division,
      participants: [],
      matches: [],
      roundNames: ["Finals"],
    };
  }

  const entrants = options?.randomize === false ? [...participants] : shuffleArray(participants);
  const power = Math.max(2, Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2)))));
  const totalRounds = Math.log2(power);
  const roundNames = getRoundNames(totalRounds);
  const byesCount = power - n;

  const matches: TournamentMatch[] = [];

  // Create empty matches for all rounds
  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = power / Math.pow(2, r);
    for (let m = 1; m <= matchesInRound; m++) {
      const matchId = `${division}_r${r}_m${m}`;
      const nextMatchId = r < totalRounds ? `${division}_r${r + 1}_m${Math.ceil(m / 2)}` : null;
      const nextMatchSlot = r < totalRounds ? ((m % 2 === 1 ? 1 : 2) as 1 | 2) : null;

      matches.push({
        id: matchId,
        round: r,
        matchNumber: m,
        participant1Id: null,
        participant2Id: null,
        score1: null,
        score2: null,
        winnerId: null,
        status: "pending",
        nextMatchId,
        nextMatchSlot,
      });
    }
  }

  // Populate Round 1 with entrants and byes
  // Round 1 has power / 2 matches
  const r1MatchesCount = power / 2;
  let entrantIndex = 0;

  // We assign byes to the first byesCount matches (slot 2 = null)
  for (let m = 1; m <= r1MatchesCount; m++) {
    const match = matches.find((item) => item.round === 1 && item.matchNumber === m)!;
    const hasBye = m <= byesCount;

    if (hasBye) {
      const p1 = entrants[entrantIndex++];
      match.participant1Id = p1?.id ?? null;
      match.participant2Id = null;
      match.status = "bye";
      match.winnerId = p1?.id ?? null;

      // Automatically advance to Round 2
      if (match.nextMatchId && match.winnerId) {
        const nextMatch = matches.find((item) => item.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 1) {
            nextMatch.participant1Id = match.winnerId;
          } else {
            nextMatch.participant2Id = match.winnerId;
          }
        }
      }
    } else {
      const p1 = entrants[entrantIndex++];
      const p2 = entrants[entrantIndex++];
      match.participant1Id = p1?.id ?? null;
      match.participant2Id = p2?.id ?? null;
      match.status = "pending";
    }
  }

  return {
    division,
    participants: entrants,
    matches,
    roundNames,
  };
}

/**
 * Reshuffles matchups in a bracket while keeping the same participants.
 */
export function reshuffleBracketMatchups(bracket: TournamentBracket): TournamentBracket {
  return generateBracket(bracket.division, bracket.participants, { randomize: true });
}

/**
 * Sets the winner of a match and advances them to the downstream match.
 * Changing the advancing participant invalidates every dependent result.
 * Score-only corrections with the same winner preserve downstream results.
 */
export function setMatchWinner(
  bracket: TournamentBracket,
  matchId: string,
  winnerId: string | null,
  scores?: { score1: number | null; score2: number | null },
): TournamentBracket {
  const matches = bracket.matches.map((m) => ({ ...m }));
  const target = matches.find((m) => m.id === matchId);
  if (!target) return bracket;

  if (winnerId !== null) {
    if (!target.participant1Id || !target.participant2Id) {
      throw new Error("Both participants must be known before recording a winner");
    }
    if (winnerId !== target.participant1Id && winnerId !== target.participant2Id) {
      throw new Error("Winner must be a participant in this match");
    }
  }

  target.winnerId = winnerId;
  target.status = winnerId ? "completed" : "pending";
  if (winnerId === null) {
    target.score1 = null;
    target.score2 = null;
  } else if (scores) {
    target.score1 = scores.score1;
    target.score2 = scores.score2;
  }

  // A changed opponent invalidates a result even if that opponent lost.
  // Keep the unaffected side of each match, but clear the dependent winner
  // all the way to the final rather than transferring an old score to new players.
  let upstream = target;
  while (upstream.nextMatchId) {
    const downstream = matches.find((match) => match.id === upstream.nextMatchId);
    if (!downstream || !upstream.nextMatchSlot) break;
    const slot = upstream.nextMatchSlot === 1 ? "participant1Id" : "participant2Id";
    if (downstream[slot] === upstream.winnerId) break;

    downstream[slot] = upstream.winnerId;
    downstream.winnerId = null;
    downstream.score1 = null;
    downstream.score2 = null;
    downstream.status = "pending";
    upstream = downstream;
  }

  return {
    ...bracket,
    matches,
  };
}

/**
 * Updates a participant slot in a match (e.g. manual edit or swap).
 */
export function updateMatchParticipant(
  bracket: TournamentBracket,
  matchId: string,
  slot: 1 | 2,
  newParticipantId: string | null,
): TournamentBracket {
  const matches = bracket.matches.map((m) => ({ ...m }));
  const target = matches.find((m) => m.id === matchId);
  if (!target) return bracket;

  const oldParticipantId = slot === 1 ? target.participant1Id : target.participant2Id;
  if (oldParticipantId === newParticipantId) return bracket;

  if (slot === 1) {
    target.participant1Id = newParticipantId;
  } else {
    target.participant2Id = newParticipantId;
  }

  // If match was completed or had winner, reset winner because participant changed
  if (target.winnerId) {
    return setMatchWinner({ ...bracket, matches }, target.id, null);
  }

  return {
    ...bracket,
    matches,
  };
}

/**
 * Swaps two participants across slots or matches in the same bracket.
 */
export function swapParticipants(
  bracket: TournamentBracket,
  match1Id: string,
  slot1: 1 | 2,
  match2Id: string,
  slot2: 1 | 2,
): TournamentBracket {
  const m1 = bracket.matches.find((m) => m.id === match1Id);
  const m2 = bracket.matches.find((m) => m.id === match2Id);
  if (!m1 || !m2) return bracket;

  const p1 = slot1 === 1 ? m1.participant1Id : m1.participant2Id;
  const p2 = slot2 === 1 ? m2.participant1Id : m2.participant2Id;

  let updated = updateMatchParticipant(bracket, match1Id, slot1, p2);
  updated = updateMatchParticipant(updated, match2Id, slot2, p1);
  return updated;
}

