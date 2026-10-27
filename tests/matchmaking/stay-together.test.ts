import { describe, expect, it } from "vitest";
import { generateRound } from "@/lib/matchmaking/generate-round";
import { validateStayTogetherPairs, validateStayTogetherLineup } from "@/lib/matchmaking/stay-together";
import { scoreRound } from "@/lib/matchmaking/score-round";
import { emptyPairHistory } from "@/lib/matchmaking/pairs";
import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import type { MatchmakingPlayer, StayTogetherPair } from "@/lib/matchmaking/types";
const players = (count: number): MatchmakingPlayer[] => Array.from({ length: count }, (_, i) => ({
  id: String(i), name: String(i), rating: 1000 + i * 50, gamesPlayed: 0, eligibleRounds: 0, satPreviousRound: false,
}));
const pairs: StayTogetherPair[] = [["0", "1"], ["2", "3"]];
const config = { ...DEFAULT_MATCHMAKING_CONFIG, iterations: 100 };

describe("Stay Together", () => {
  it("rejects self, overlapping and unknown pair members", () => {
    expect(validateStayTogetherPairs([["0", "0"]], ["0", "1"])).toBeTruthy();
    expect(validateStayTogetherPairs([["0", "1"], ["1", "2"]], ["0", "1", "2"])).toBeTruthy();
    expect(validateStayTogetherPairs([["0", "9"]], ["0", "1"])).toBeTruthy();
    expect(validateStayTogetherPairs(pairs, ["0", "1", "2", "3"])).toBeNull();
  });
  it("keeps active friends on one team across seeds and temperatures", () => {
    for (let seed = 0; seed < 15; seed++) {
      const roster = players(8);
      const result = generateRound({ players: roster, courts: 2, pairHistory: [], stayTogetherPairs: pairs, seed, temperature: 2, config });
      expect(result.ok).toBe(true);
      if (result.ok) expect(validateStayTogetherLineup(result.value, pairs, roster.map(p => p.id))).toBeNull();
    }
  });
  it.each([5, 9])("rotates the one bench place through all %i players", count => {
    let roster = players(count);
    const friends: StayTogetherPair[] = Array.from({ length: Math.floor(count / 2) }, (_, i) => [String(i * 2), String(i * 2 + 1)]);
    const sits = new Map<string, number>();
    for (let round = 0; round < count * 2; round++) {
      const result = generateRound({ players: roster, courts: Math.floor(count / 4), pairHistory: [], stayTogetherPairs: friends, seed: round, config });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(validateStayTogetherLineup(result.value, friends, roster.map(p => p.id))).toBeNull();
      expect(result.value.sitting).toHaveLength(1);
      const sitter = result.value.sitting[0];
      expect(roster.find(p => p.id === sitter)?.satPreviousRound).toBe(false);
      sits.set(sitter, (sits.get(sitter) ?? 0) + 1);
      roster = roster.map(p => ({ ...p, gamesPlayed: p.gamesPlayed + (p.id === sitter ? 0 : 1), eligibleRounds: p.eligibleRounds + 1, satPreviousRound: p.id === sitter }));
    }
    expect([...sits.values()]).toEqual(expect.arrayContaining([2]));
    expect(sits.size).toBe(count);
    expect(Math.max(...sits.values()) - Math.min(...sits.values())).toBeLessThanOrEqual(1);
  });
  it("sits whole pairs when there are two bench places", () => {
    const roster = players(6);
    const friends: StayTogetherPair[] = [...pairs, ["4", "5"]];
    const result = generateRound({ players: roster, courts: 1, pairHistory: [], stayTogetherPairs: friends, config, seed: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(friends.some(pair => pair.every(id => result.value.sitting.includes(id)))).toBe(true);
      expect(validateStayTogetherLineup(result.value, friends, roster.map(p => p.id))).toBeNull();
    }
  });
  it("temporarily ignores a pair whose friend is absent", () => {
    const roster = players(5).filter(p => p.id !== "1");
    const result = generateRound({ players: roster, courts: 1, pairHistory: [], stayTogetherPairs: pairs, config, seed: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(validateStayTogetherLineup(result.value, pairs, roster.map(p => p.id))).toBeNull();
  });
  it("reports incompatible singles instead of separating active friends", () => {
    const result = generateRound({ players: players(4), courts: 2, courtPlayerCounts: [2, 2], pairHistory: [], stayTogetherPairs: pairs, config });
    expect(result).toMatchObject({ ok: false, error: { code: "INCOMPATIBLE_PARTNERS" } });
  });
  it("rejects custom lineups that split active friends or use the solo exception with multiple bench places", () => {
    expect(validateStayTogetherLineup({ courts: [{ courtNumber: 1, team1: ["0", "2"], team2: ["1", "3"] }], sitting: [] }, pairs, ["0", "1", "2", "3"])).toBeTruthy();
    expect(validateStayTogetherLineup({ courts: [{ courtNumber: 1, team1: ["1", "3"], team2: ["4", "5"] }], sitting: ["0", "2"] }, pairs, players(6).map(p => p.id))).toBeTruthy();
  });
  it("exempts intentional friend repeats while retaining ordinary partner penalties", () => {
    const context = { players: players(4), config, sittingPenalty: { playingTime: 0, consecutiveSit: 0 }, tieBreak: 0,
      pairHistory: [{ ...emptyPairHistory("0", "1"), sessionPartnerCount: 3, roundsSincePartner: 1 }] };
    const candidate = { courts: [{ courtNumber: 1, team1: ["0", "1"] as const, team2: ["2", "3"] as const }], sitting: [] };
    expect(scoreRound(candidate, context).partnerRepeat).toBeGreaterThan(0);
    expect(scoreRound(candidate, { ...context, stayTogetherPairs: pairs }).partnerRepeat).toBe(0);
  });
  it("supports the variety setting without relaxing fixed partners or seating fairness", () => {
    const input = { players: players(12), courts: 3, pairHistory: [], stayTogetherPairs: pairs, config, seed: 44 };
    const balanced = generateRound({ ...input, temperature: 0 });
    const varied = generateRound({ ...input, temperature: 2 });
    expect(varied.ok).toBe(true);
    if (varied.ok) expect(validateStayTogetherLineup(varied.value, pairs, input.players.map(p => p.id))).toBeNull();
    expect(varied).not.toEqual(balanced);
  });
  it("is deterministic and supports mixed courts and 24 attendees", () => {
    const roster = players(24);
    const input = { players: roster, courts: 6, courtPlayerCounts: [4, 4, 4, 4, 3, 2] as const, pairHistory: [], stayTogetherPairs: pairs, seed: 21, config };
    const first = generateRound(input);
    expect(first.ok).toBe(true);
    expect(generateRound(input)).toEqual(first);
    if (first.ok) expect(validateStayTogetherLineup(first.value, pairs, roster.map(p => p.id))).toBeNull();
  });
});
