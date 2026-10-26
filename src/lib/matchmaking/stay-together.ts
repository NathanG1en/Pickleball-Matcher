import type { RoundCandidate, StayTogetherPair } from "./types";

export function validateStayTogetherPairs(pairs: readonly StayTogetherPair[], playerIds: readonly string[]): string | null {
  const allowed = new Set(playerIds);
  const used = new Set<string>();
  for (const pair of pairs) {
    if (pair.length !== 2 || pair[0] === pair[1]) return "Choose two different players for each Stay Together pair.";
    for (const id of pair) {
      if (!allowed.has(id)) return "Stay Together partners must be selected players from this session's group.";
      if (used.has(id)) return "Each player can have only one Stay Together partner.";
      used.add(id);
    }
  }
  return null;
}

export function canonicalPairs(pairs: readonly StayTogetherPair[]): StayTogetherPair[] {
  return pairs.map(([a, b]): StayTogetherPair => a < b ? [a, b] : [b, a])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

export function validateStayTogetherLineup(candidate: RoundCandidate, pairs: readonly StayTogetherPair[], presentIds: readonly string[]): string | null {
  const present = new Set(presentIds);
  const sitting = new Set(candidate.sitting);
  const teams = candidate.courts.flatMap(c => [c.team1, c.team2]);
  for (const [a, b] of pairs) {
    if (!present.has(a) || !present.has(b)) continue;
    if (sitting.has(a) && sitting.has(b)) continue;
    if (sitting.has(a) !== sitting.has(b)) {
      if (candidate.sitting.length === 1) continue;
      return "Stay Together partners must sit together unless there is exactly one bench spot.";
    }
    if (!teams.some(team => team.length === 2 && team.includes(a) && team.includes(b))) {
      return "Stay Together partners who are playing must be on the same team. Change the pair or lineup.";
    }
  }
  return null;
}
