import { DEFAULT_MATCHMAKING_CONFIG } from "./config";
import { buildPairHistoryIndex } from "./pairs";
import { createSeededRandom } from "./random";
import { scoreRound } from "./score-round";
import { participationLoad, scoreSittingChoice } from "./sitting";
import { canonicalPairs, validateStayTogetherPairs } from "./stay-together";
import type { CourtAssignment, GenerateRoundInput, GenerationResult, Team } from "./types";

type Seating = { sitting: string[]; activePairs: string[][]; activeSingles: string[]; repeats: number; load: number; tie: number };
const incompatible = (message = "Stay Together pairs do not fit these courts. Change the court sizes or remove a pair."): GenerationResult => ({ ok: false, error: { code: "INCOMPATIBLE_PARTNERS", message } });

/** Allocate whole friend blocks using memoized capacity states, never roster permutations. */
export function generatePairedRound(input: GenerateRoundInput): GenerationResult {
  const config = input.config ?? DEFAULT_MATCHMAKING_CONFIG;
  const roster = new Map(input.players.map(p => [p.id, p]));
  const pairs = canonicalPairs(input.stayTogetherPairs ?? []);
  // Missing friends are allowed; only pairs whose two players are present are active.
  const error = validateStayTogetherPairs(pairs, [...new Set([...roster.keys(), ...pairs.flat()])]);
  if (error) return incompatible(error);
  const activePairs = pairs.filter(pair => pair.every(id => roster.has(id)));
  const paired = new Set(activePairs.flat());
  const blocks = [...activePairs.map(p => [...p]), ...input.players.filter(p => !paired.has(p.id)).map(p => [p.id])];
  const doubles = Math.min(Math.floor(input.players.length / 4), input.courts);
  const sizes = input.courtPlayerCounts ?? [
    ...Array<number>(doubles).fill(4),
    ...(input.allowSingles !== false && input.courts > doubles && input.players.length - 4 * doubles >= 2 ? [2] : []),
  ];
  const teamSizes = sizes.flatMap(size => size === 4 ? [2, 2] : size === 3 ? [2, 1] : [1, 1]);
  const pairSlots = teamSizes.filter(size => size === 2).length;
  const benchCount = input.players.length - sizes.reduce((sum, size) => sum + size, 0);
  let seed = input.seed;
  if (seed === undefined) {
    seed = 2166136261;
    for (const c of JSON.stringify([input.players, sizes, pairs, input.temperature ?? 0])) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  const random = createSeededRandom(seed);
  const groupGames = input.players.reduce((sum, p) => sum + p.gamesPlayed, 0);
  const groupRounds = input.players.reduce((sum, p) => sum + p.eligibleRounds, 0);
  const average = groupRounds === 0 ? 0 : groupGames / groupRounds;
  const ties = new Map(input.players.map(p => [p.id, random.next()]));
  const memo = new Map<string, Seating | null>();
  const better = (a: Seating, b: Seating | null) => !b || a.repeats < b.repeats || (a.repeats === b.repeats && (a.load > b.load + 1e-10 || (Math.abs(a.load - b.load) <= 1e-10 && a.tie < b.tie)));
  function allocate(index: number, bench: number, pairsUsed: number): Seating | null {
    if (bench < 0 || pairsUsed > pairSlots) return null;
    if (index === blocks.length) return bench === 0 ? { sitting: [], activePairs: [], activeSingles: [], repeats: 0, load: 0, tie: 0 } : null;
    const key = `${index}:${bench}:${pairsUsed}`;
    if (memo.has(key)) return memo.get(key)!;
    const block = blocks[index];
    const options = [{ sitting: [] as string[], active: block }, { sitting: block, active: [] as string[] },
      ...(benchCount === 1 && block.length === 2 ? [{ sitting: [block[0]], active: [block[1]] }, { sitting: [block[1]], active: [block[0]] }] : [])];
    let best: Seating | null = null;
    for (const option of options) {
      const tail = allocate(index + 1, bench - option.sitting.length, pairsUsed + (option.active.length === 2 ? 1 : 0));
      if (!tail) continue;
      const sitters = option.sitting.map(id => roster.get(id)!);
      const candidate: Seating = {
        sitting: [...option.sitting, ...tail.sitting],
        activePairs: option.active.length === 2 ? [option.active, ...tail.activePairs] : tail.activePairs,
        activeSingles: option.active.length === 1 ? [...option.active, ...tail.activeSingles] : tail.activeSingles,
        repeats: tail.repeats + sitters.filter(p => p.satPreviousRound).length,
        load: tail.load + sitters.reduce((sum, p) => sum + participationLoad(p, average), 0),
        tie: tail.tie + option.sitting.reduce((sum, id) => sum + ties.get(id)!, 0),
      };
      if (better(candidate, best)) best = candidate;
    }
    memo.set(key, best);
    return best;
  }
  const seating = allocate(0, benchCount, 0);
  if (!seating) return incompatible();
  const history = buildPairHistoryIndex(input.pairHistory);
  const sittingPenalty = scoreSittingChoice({ players: input.players, sitting: seating.sitting });
  let best: { courts: CourtAssignment[]; breakdown: ReturnType<typeof scoreRound> } | null = null;
  const alternatives: { courts: CourtAssignment[]; breakdown: ReturnType<typeof scoreRound>; key: string }[] = [];
  const temperature = Math.max(0, input.temperature ?? 0);
  for (let iteration = 0; iteration < Math.max(1, config.iterations); iteration++) {
    const singles = random.shuffle(seating.activeSingles);
    const teams: Team[] = random.shuffle(seating.activePairs).map(pair => [pair[0], pair[1]]);
    while (teams.length < pairSlots) teams.push([singles.pop()!, singles.pop()!]);
    const doublesTeams = random.shuffle(teams);
    const courts: CourtAssignment[] = sizes.map((size, i) => ({
      courtNumber: i + 1,
      team1: size >= 3 ? doublesTeams.pop()! : [singles.pop()!],
      team2: size === 4 ? doublesTeams.pop()! : [singles.pop()!],
      matchType: size === 4 ? "doubles" : size === 3 ? "team-vs-one" : "singles",
    }));
    const breakdown = scoreRound({ courts, sitting: seating.sitting }, { players: input.players, pairHistory: history, config, sittingPenalty, tieBreak: random.next() * config.tieBreakMaximum, stayTogetherPairs: activePairs });
    if (!best || breakdown.total < best.breakdown.total) best = { courts, breakdown };
    if (temperature > 0) {
      const key = courts.map(c => [c.team1.slice().sort().join(","), c.team2.slice().sort().join(",")].sort().join("v")).sort().join(";");
      if (!alternatives.some(candidate => candidate.key === key)) {
        alternatives.push({ courts, breakdown, key });
        alternatives.sort((a, b) => a.breakdown.total - b.breakdown.total);
        if (alternatives.length > 30) alternatives.pop();
      }
    }
  }
  if (temperature > 0 && alternatives.length) {
    const weights = alternatives.map(candidate => Math.exp(-(candidate.breakdown.total - alternatives[0].breakdown.total) / (15 * temperature)));
    let remaining = random.next() * weights.reduce((sum, weight) => sum + weight, 0);
    best = alternatives[alternatives.length - 1];
    for (let i = 0; i < alternatives.length; i++) {
      remaining -= weights[i];
      if (remaining <= 0) { best = alternatives[i]; break; }
    }
  }
  return { ok: true, value: { courts: best!.courts, sitting: seating.sitting, seed, score: best!.breakdown.total, scoreBreakdown: best!.breakdown } };
}
