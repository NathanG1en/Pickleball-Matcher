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
export function createParticipantsForDivision(
  division: TournamentDivision,
  players: readonly PlayerRecord[],
): TournamentParticipant[] {
  if (players.length === 0) return [];

  if (division === "mens_singles") {
    const maleOnly = players.filter((p) => p.gender === "male");
    const nonFemale = players.filter((p) => p.gender !== "female");
    const eligible =
      maleOnly.length >= 2 ? maleOnly : nonFemale.length >= 2 ? nonFemale : players;
    return eligible.map((p, idx) => ({
      id: p.id,
      name: p.name,
      playerIds: [p.id],
      seed: idx + 1,
    }));
  }

  if (division === "womens_singles") {
    const femaleOnly = players.filter((p) => p.gender === "female");
    const nonMale = players.filter((p) => p.gender !== "male");
    const eligible =
      femaleOnly.length >= 2 ? femaleOnly : nonMale.length >= 2 ? nonMale : players;
    return eligible.map((p, idx) => ({
      id: p.id,
      name: p.name,
      playerIds: [p.id],
      seed: idx + 1,
    }));
  }

  if (division === "mens_doubles") {
    const maleOnly = players.filter((p) => p.gender === "male");
    const nonFemale = players.filter((p) => p.gender !== "female");
    const eligible =
      maleOnly.length >= 2 ? maleOnly : nonFemale.length >= 2 ? nonFemale : players;
    const shuffled = shuffleArray(eligible);
    const teams: TournamentParticipant[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i]!;
      const p2 = shuffled[i + 1];
      if (p2) {
        teams.push({
          id: `team_${p1.id}_${p2.id}`,
          name: `${p1.name} & ${p2.name}`,
          playerIds: [p1.id, p2.id],
          seed: teams.length + 1,
        });
      } else {
        teams.push({
          id: p1.id,
          name: p1.name,
          playerIds: [p1.id],
          seed: teams.length + 1,
        });
      }
    }
    return teams;
  }

  if (division === "womens_doubles") {
    const femaleOnly = players.filter((p) => p.gender === "female");
    const nonMale = players.filter((p) => p.gender !== "male");
    const eligible =
      femaleOnly.length >= 2 ? femaleOnly : nonMale.length >= 2 ? nonMale : players;
    const shuffled = shuffleArray(eligible);
    const teams: TournamentParticipant[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i]!;
      const p2 = shuffled[i + 1];
      if (p2) {
        teams.push({
          id: `team_${p1.id}_${p2.id}`,
          name: `${p1.name} & ${p2.name}`,
          playerIds: [p1.id, p2.id],
          seed: teams.length + 1,
        });
      } else {
        teams.push({
          id: p1.id,
          name: p1.name,
          playerIds: [p1.id],
          seed: teams.length + 1,
        });
      }
    }
    return teams;
  }

  if (division === "mixed_doubles") {
    const males = shuffleArray(players.filter((p) => p.gender === "male"));
    const females = shuffleArray(players.filter((p) => p.gender === "female"));
    const unassigned = shuffleArray(players.filter((p) => !p.gender));

    // Distribute unassigned players to balance males and females
    for (const p of unassigned) {
      if (males.length <= females.length) {
        males.push(p);
      } else {
        females.push(p);
      }
    }

    const teams: TournamentParticipant[] = [];
    const minPairs = Math.min(males.length, females.length);

    for (let i = 0; i < minPairs; i++) {
      const m = males[i]!;
      const f = females[i]!;
      teams.push({
        id: `team_${m.id}_${f.id}`,
        name: `${m.name} & ${f.name}`,
        playerIds: [m.id, f.id],
        seed: teams.length + 1,
      });
    }

    // Any remaining players paired together
    const remaining = [...males.slice(minPairs), ...females.slice(minPairs)];
    for (let i = 0; i < remaining.length; i += 2) {
      const p1 = remaining[i]!;
      const p2 = remaining[i + 1];
      if (p2) {
        teams.push({
          id: `team_${p1.id}_${p2.id}`,
          name: `${p1.name} & ${p2.name}`,
          playerIds: [p1.id, p2.id],
          seed: teams.length + 1,
        });
      } else {
        teams.push({
          id: p1.id,
          name: p1.name,
          playerIds: [p1.id],
          seed: teams.length + 1,
        });
      }
    }

    if (teams.length === 0 && players.length >= 2) {
      const shuffled = shuffleArray(players);
      for (let i = 0; i < shuffled.length; i += 2) {
        const p1 = shuffled[i]!;
        const p2 = shuffled[i + 1];
        if (p2) {
          teams.push({
            id: `team_${p1.id}_${p2.id}`,
            name: `${p1.name} & ${p2.name}`,
            playerIds: [p1.id, p2.id],
            seed: teams.length + 1,
          });
        }
      }
    }

    return teams;
  }

  return [];
}

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
 * If winnerId is null, resets the winner and downstream matches.
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

  const previousWinnerId = target.winnerId;
  target.winnerId = winnerId;
  target.status = winnerId ? "completed" : "pending";
  if (scores) {
    target.score1 = scores.score1;
    target.score2 = scores.score2;
  }

  // Advance or clear in next round
  if (target.nextMatchId) {
    const nextMatch = matches.find((m) => m.id === target.nextMatchId);
    if (nextMatch) {
      if (winnerId) {
        if (target.nextMatchSlot === 1) {
          nextMatch.participant1Id = winnerId;
        } else {
          nextMatch.participant2Id = winnerId;
        }
      } else {
        // If we unset or changed the winner, clear previous winner downstream
        if (target.nextMatchSlot === 1) {
          if (nextMatch.participant1Id === previousWinnerId) nextMatch.participant1Id = null;
        } else {
          if (nextMatch.participant2Id === previousWinnerId) nextMatch.participant2Id = null;
        }
        // If downstream match was completed, unset it as well
        if (nextMatch.winnerId === previousWinnerId) {
          return setMatchWinner({ ...bracket, matches }, nextMatch.id, null);
        }
      }
    }
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

