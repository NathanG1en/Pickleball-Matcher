import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { generateRound } from "@/lib/matchmaking/generate-round";
import { pairKey } from "@/lib/matchmaking/pairs";
import { createSeededRandom } from "@/lib/matchmaking/random";
import { chooseSittingPlayers } from "@/lib/matchmaking/sitting";
import type {
  CourtAssignment,
  MatchmakingPlayer,
  PairHistory,
  RoundCandidate,
} from "@/lib/matchmaking/types";
import { makePlayers } from "@/test-support/factories";

const SIMULATION_CONFIG = { ...DEFAULT_MATCHMAKING_CONFIG, iterations: 1_000 };

function addPairHistory(
  history: Map<string, PairHistory>,
  first: string,
  second: string,
  relationship: "partner" | "opponent",
) {
  const key = pairKey(first, second);
  const current = history.get(key) ?? {
    player1Id: first,
    player2Id: second,
    sessionPartnerCount: 0,
    sessionOpponentCount: 0,
    roundsSincePartner: null,
    roundsSinceOpponent: null,
    lifetimePartnerCount: 0,
    lifetimeOpponentCount: 0,
  };
  history.set(key, {
    ...current,
    sessionPartnerCount:
      current.sessionPartnerCount + (relationship === "partner" ? 1 : 0),
    sessionOpponentCount:
      current.sessionOpponentCount + (relationship === "opponent" ? 1 : 0),
    roundsSincePartner: relationship === "partner" ? 1 : current.roundsSincePartner,
    roundsSinceOpponent: relationship === "opponent" ? 1 : current.roundsSinceOpponent,
  });
}

function advanceHistory(history: Map<string, PairHistory>, candidate: RoundCandidate) {
  for (const [key, value] of history) {
    history.set(key, {
      ...value,
      roundsSincePartner:
        value.roundsSincePartner === null ? null : value.roundsSincePartner + 1,
      roundsSinceOpponent:
        value.roundsSinceOpponent === null ? null : value.roundsSinceOpponent + 1,
    });
  }
  for (const court of candidate.courts) {
    if (court.team1.length === 2 && court.team2.length === 2) {
      addPairHistory(history, court.team1[0], court.team1[1], "partner");
      addPairHistory(history, court.team2[0], court.team2[1], "partner");
    }
    for (const first of court.team1) {
      for (const second of court.team2) addPairHistory(history, first, second, "opponent");
    }
  }
}

function advancePlayers(
  players: readonly MatchmakingPlayer[],
  candidate: RoundCandidate,
): MatchmakingPlayer[] {
  const nonstandard = candidate.courts
    .filter((c) => c.matchType === "singles" || c.matchType === "team-vs-one" || c.team1.length + c.team2.length < 4)
    .flatMap((c) => [...c.team1, ...c.team2]);
  const effectiveSitting = new Set([...candidate.sitting, ...nonstandard]);
  return players.map((player) => ({
    ...player,
    eligibleRounds: player.eligibleRounds + 1,
    gamesPlayed: player.gamesPlayed + (effectiveSitting.has(player.id) ? 0 : 1),
    satPreviousRound: effectiveSitting.has(player.id),
  }));
}

function randomBaseline(
  players: readonly MatchmakingPlayer[],
  courts: number,
  seed: number,
): RoundCandidate {
  const random = createSeededRandom(seed);
  const courtCount = Math.min(Math.floor(players.length / 4), courts);
  const sitting = chooseSittingPlayers({
    players,
    sitCount: players.length - courtCount * 4,
    random,
    config: SIMULATION_CONFIG,
  });
  const sittingSet = new Set(sitting);
  const active = random.shuffle(players.filter((player) => !sittingSet.has(player.id)));
  const assignments: CourtAssignment[] = [];
  for (let index = 0; index < active.length; index += 4) {
    assignments.push({
      courtNumber: assignments.length + 1,
      team1: [active[index].id, active[index + 1].id],
      team2: [active[index + 2].id, active[index + 3].id],
    });
  }
  return { courts: assignments, sitting };
}

function repeatedPartnerCount(history: Map<string, PairHistory>): number {
  return [...history.values()].reduce(
    (total, item) => total + Math.max(0, item.sessionPartnerCount - 1),
    0,
  );
}

function totalSkillDifference(
  candidate: RoundCandidate,
  players: readonly MatchmakingPlayer[],
): number {
  const ratings = new Map(players.map((player) => [player.id, player.rating]));
  return candidate.courts.reduce((total, court) => {
    const team1 =
      court.team1.length === 1
        ? ratings.get(court.team1[0])!
        : (ratings.get(court.team1[0])! + ratings.get(court.team1[1])!) / 2;
    const team2 =
      court.team2.length === 1
        ? ratings.get(court.team2[0])!
        : (ratings.get(court.team2[0])! + ratings.get(court.team2[1])!) / 2;
    return total + Math.abs(team1 - team2);
  }, 0);
}

describe("matchmaking simulations", () => {
  it("keeps 14-player participation even without consecutive sits over seven rounds", () => {
    let players = makePlayers(14);
    const history = new Map<string, PairHistory>();
    let previousSitting = new Set<string>();

    for (let round = 1; round <= 7; round += 1) {
      const result = generateRound({
        players,
        courts: 3,
        pairHistory: [...history.values()],
        config: SIMULATION_CONFIG,
        seed: round * 101,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.sitting.some((id) => previousSitting.has(id))).toBe(false);
      previousSitting = new Set(result.value.sitting);
      advanceHistory(history, result.value);
      players = advancePlayers(players, result.value);
    }

    const gameCounts = players.map((player) => player.gamesPlayed);
    expect(Math.max(...gameCounts) - Math.min(...gameCounts)).toBeLessThanOrEqual(1);
  });

  it("beats a deterministic random baseline for partner repetition and skill balance", () => {
    let matchedPlayers = makePlayers(14, (index) => ({ rating: 850 + index * 25 }));
    let randomPlayers = structuredClone(matchedPlayers);
    const matchedHistory = new Map<string, PairHistory>();
    const randomHistory = new Map<string, PairHistory>();
    let matchedSkillDifference = 0;
    let randomSkillDifference = 0;

    for (let round = 1; round <= 12; round += 1) {
      const result = generateRound({
        players: matchedPlayers,
        courts: 3,
        pairHistory: [...matchedHistory.values()],
        config: SIMULATION_CONFIG,
        seed: round * 313,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const baseline = randomBaseline(randomPlayers, 3, round * 313);
      matchedSkillDifference += totalSkillDifference(result.value, matchedPlayers);
      randomSkillDifference += totalSkillDifference(baseline, randomPlayers);
      advanceHistory(matchedHistory, result.value);
      advanceHistory(randomHistory, baseline);
      matchedPlayers = advancePlayers(matchedPlayers, result.value);
      randomPlayers = advancePlayers(randomPlayers, baseline);
    }

    expect(repeatedPartnerCount(matchedHistory)).toBeLessThan(
      repeatedPartnerCount(randomHistory) * 0.75,
    );
    expect(matchedSkillDifference).toBeLessThan(randomSkillDifference);
  });

  it("generates normal 24-player rounds below the 500 ms median target", () => {
    const players = makePlayers(24, (index) => ({ rating: 800 + index * 20 }));
    const durations: number[] = [];

    for (let run = 1; run <= 30; run += 1) {
      const started = performance.now();
      const result = generateRound({
        players,
        courts: 6,
        pairHistory: [],
        seed: run,
      });
      durations.push(performance.now() - started);
      expect(result.ok).toBe(true);
    }

    durations.sort((first, second) => first - second);
    expect(durations[Math.floor(durations.length / 2)]).toBeLessThan(500);
  });

  it("rotates nonstandard matches so prior singles/2v1 players receive sit credit and play doubles next round", () => {
    // 7 players, 2 courts: Court 1 doubles (4), Court 2 2v1 (3). 0 physical sitters.
    // In each round, the 3 players who play 2v1 receive sit credit (effective sit).
    // In the following round, they should NOT be assigned to 2v1 again.
    let players = makePlayers(7, (index) => ({ rating: 1000 + index * 50 }));
    const history = new Map<string, PairHistory>();

    for (let round = 1; round <= 5; round++) {
      const result = generateRound({
        players,
        courts: 2,
        courtPlayerCounts: [4, 3],
        pairHistory: [...history.values()],
        config: SIMULATION_CONFIG,
        seed: round * 100,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const nonstandardCourt = result.value.courts.find((c) => c.matchType === "team-vs-one");
      expect(nonstandardCourt).toBeDefined();
      const nonstandardPlayers = [...nonstandardCourt!.team1, ...nonstandardCourt!.team2];

      // Any player who played 2v1 in the previous round (satPreviousRound: true)
      // must NOT be assigned to 2v1 in this round!
      for (const p of players) {
        if (p.satPreviousRound) {
          expect(nonstandardPlayers).not.toContain(p.id);
        }
      }

      advanceHistory(history, result.value);
      players = advancePlayers(players, result.value);
    }
  });
});
