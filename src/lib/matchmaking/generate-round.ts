import { generatePairedRound } from "./generate-paired-round";
import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { buildPairHistoryIndex } from "@/lib/matchmaking/pairs";
import { createSeededRandom } from "@/lib/matchmaking/random";
import { scoreRound } from "@/lib/matchmaking/score-round";
import { chooseSittingPlayers, scoreSittingChoice } from "@/lib/matchmaking/sitting";
import type {
  CourtAssignment,
  GenerateRoundInput,
  GenerationResult,
  MatchmakingPlayer,
  PlayerId,
  RoundCandidate,
  ScoreBreakdown,
  Team,
} from "@/lib/matchmaking/types";

function stableInputSeed(
  players: readonly MatchmakingPlayer[],
  courts: number,
  courtPlayerCounts?: readonly number[],
  temperature = 0,
): number {
  let hash = 0x811c9dc5;
  const value = `${courts}|${courtPlayerCounts?.join(",") ?? "default"}|${temperature}|${players
    .map((player) => `${player.id}:${player.gamesPlayed}:${player.eligibleRounds}:${player.timesPlayed2v1 ?? 0}`)
    .join("|")}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pairingOptions(group: readonly PlayerId[]): readonly [Team, Team][] {
  const [a, b, c, d] = group;
  return [
    [
      [a, b],
      [c, d],
    ],
    [
      [a, c],
      [b, d],
    ],
    [
      [a, d],
      [b, c],
    ],
  ];
}

function bestCourtPairing(
  group: readonly PlayerId[],
  courtNumber: number,
  candidateContext: Omit<Parameters<typeof scoreRound>[1], "tieBreak">,
): CourtAssignment {
  let bestCourt: CourtAssignment | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const [team1, team2] of pairingOptions(group)) {
    const court: CourtAssignment = { courtNumber, team1, team2, matchType: "doubles" };
    const score = scoreRound(
      { courts: [court], sitting: [] },
      { ...candidateContext, tieBreak: 0 },
    ).total;
    if (score < bestScore) {
      bestCourt = court;
      bestScore = score;
    }
  }

  if (!bestCourt) throw new Error("A group of four must have a valid pairing");
  return bestCourt;
}

function candidateKey(candidate: RoundCandidate): string {
  const courtsPart = candidate.courts
    .map((c) => {
      const t1 = [...c.team1].sort().join(",");
      const t2 = [...c.team2].sort().join(",");
      return [t1, t2].sort().join("v");
    })
    .sort()
    .join(";");
  const sitPart = [...candidate.sitting].sort().join(",");
  return `${courtsPart}|${sitPart}`;
}

interface ScoredCandidate {
  readonly candidate: RoundCandidate;
  readonly breakdown: ScoreBreakdown;
  readonly key: string;
}

class CandidatePool {
  private pool: ScoredCandidate[] = [];
  private readonly maxPoolSize = 30;

  constructor(private readonly temperature: number) {}

  add(candidate: RoundCandidate, breakdown: ScoreBreakdown): void {
    if (this.temperature <= 0) {
      if (this.pool.length === 0 || breakdown.total < this.pool[0].breakdown.total) {
        this.pool = [{ candidate, breakdown, key: "" }];
      }
      return;
    }

    const key = candidateKey(candidate);
    const existingIndex = this.pool.findIndex((item) => item.key === key);
    if (existingIndex !== -1) {
      if (breakdown.total < this.pool[existingIndex].breakdown.total) {
        this.pool[existingIndex] = { candidate, breakdown, key };
        this.pool.sort((a, b) => a.breakdown.total - b.breakdown.total);
      }
      return;
    }

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push({ candidate, breakdown, key });
      this.pool.sort((a, b) => a.breakdown.total - b.breakdown.total);
    } else if (breakdown.total < this.pool[this.pool.length - 1].breakdown.total) {
      this.pool[this.pool.length - 1] = { candidate, breakdown, key };
      this.pool.sort((a, b) => a.breakdown.total - b.breakdown.total);
    }
  }

  select(random: { next(): number }): ScoredCandidate {
    if (this.pool.length === 0) {
      throw new Error("Matchmaking configuration must evaluate at least one candidate");
    }
    if (this.temperature <= 0 || this.pool.length === 1) {
      return this.pool[0];
    }

    // Boltzmann selection with temperature
    const scale = 15 * this.temperature;
    const bestScore = this.pool[0].breakdown.total;
    const weights = this.pool.map((item) =>
      Math.exp(-(item.breakdown.total - bestScore) / scale),
    );
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const threshold = random.next() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < this.pool.length; i++) {
      cumulative += weights[i];
      if (cumulative >= threshold) {
        return this.pool[i];
      }
    }
    return this.pool[0];
  }
}

export function generateRound(input: GenerateRoundInput): GenerationResult {
  const allowSingles = input.allowSingles ?? true;
  const minPlayers = allowSingles ? 2 : 4;
  if (input.players.length < minPlayers) {
    return {
      ok: false,
      error: {
        code: "INSUFFICIENT_PLAYERS",
        message: allowSingles
          ? "At least 2 players are required."
          : "At least 4 players are required for doubles.",
      },
    };
  }
  if (!Number.isSafeInteger(input.courts) || input.courts <= 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_COURT_COUNT",
        message: "At least one court is required.",
      },
    };
  }

  if (input.courtPlayerCounts && (
    input.courtPlayerCounts.length !== input.courts ||
    input.courtPlayerCounts.some((count) => ![2, 3, 4].includes(count)) ||
    input.courtPlayerCounts.reduce((sum, count) => sum + count, 0) > input.players.length
  )) {
    return { ok: false, error: { code: "INVALID_COURT_COUNT", message: "Court sizes must be 2, 3, or 4 and fit the selected players." } };
  }

  if (input.stayTogetherPairs?.length) return generatePairedRound(input);

  const config = input.config ?? DEFAULT_MATCHMAKING_CONFIG;
  const temperature = Math.max(0, input.temperature ?? 0);
  const seed = input.seed ?? stableInputSeed(input.players, input.courts, input.courtPlayerCounts, temperature);
  const random = createSeededRandom(seed);
  if (input.courtPlayerCounts) {
    const totalActivePlayers = input.courtPlayerCounts.reduce((sum, size) => sum + size, 0);
    const sitCount = input.players.length - totalActivePlayers;
    const pairHistory = buildPairHistoryIndex(input.pairHistory);
    const pool = new CandidatePool(temperature);
    for (let iteration = 0; iteration < config.iterations; iteration += 1) {
      const sitting = chooseSittingPlayers({ players: input.players, sitCount, random, config });
      const sittingSet = new Set(sitting);
      const active = random.shuffle(input.players.filter((player) => !sittingSet.has(player.id)));
      const context = { players: input.players, pairHistory, config, sittingPenalty: scoreSittingChoice({ players: input.players, sitting }) };
      const courts: CourtAssignment[] = [];
      let offset = 0;
      for (const size of input.courtPlayerCounts) {
        const ids = active.slice(offset, offset + size).map((player) => player.id);
        offset += size;
        if (size === 4) courts.push(bestCourtPairing(ids, courts.length + 1, context));
        else if (size === 2) courts.push({ courtNumber: courts.length + 1, team1: [ids[0]], team2: [ids[1]], matchType: "singles" });
        else {
          const options: readonly [Team, Team][] = [
            [[ids[0], ids[1]], [ids[2]]], [[ids[0], ids[2]], [ids[1]]], [[ids[1], ids[2]], [ids[0]]],
          ];
          let best: CourtAssignment | null = null;
          let score = Number.POSITIVE_INFINITY;
          for (const [team1, team2] of options) {
            const court: CourtAssignment = { courtNumber: courts.length + 1, team1, team2, matchType: "team-vs-one" };
            const current = scoreRound({ courts: [court], sitting: [] }, { ...context, tieBreak: 0 }).total;
            if (current < score) { best = court; score = current; }
          }
          if (best) courts.push(best);
        }
      }
      const candidate = { courts, sitting };
      const breakdown = scoreRound(candidate, { ...context, tieBreak: random.next() * config.tieBreakMaximum });
      pool.add(candidate, breakdown);
    }
    const chosen = pool.select(random);
    return { ok: true, value: { ...chosen.candidate, seed, score: chosen.breakdown.total, scoreBreakdown: chosen.breakdown } };
  }
  const doublesCourtCount = Math.min(Math.floor(input.players.length / 4), input.courts);
  const leftoverPlayers = input.players.length - doublesCourtCount * 4;
  const remainingCourts = input.courts - doublesCourtCount;
  const singlesCourtCount =
    allowSingles && leftoverPlayers >= 2 && remainingCourts >= 1 ? 1 : 0;
  const totalActivePlayers = doublesCourtCount * 4 + singlesCourtCount * 2;
  const sitCount = input.players.length - totalActivePlayers;
  const pairHistory = buildPairHistoryIndex(input.pairHistory);
  const pool = new CandidatePool(temperature);

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    const sitting = chooseSittingPlayers({
      players: input.players,
      sitCount,
      random,
      config,
    });
    const sittingSet = new Set(sitting);
    const activePlayers = random.shuffle(
      input.players.filter((player) => !sittingSet.has(player.id)),
    );
    const sittingPenalty = scoreSittingChoice({ players: input.players, sitting });
    const context = {
      players: input.players,
      pairHistory,
      config,
      sittingPenalty,
    };
    const courts: CourtAssignment[] = [];
    const doublesPlayerCount = doublesCourtCount * 4;

    for (let index = 0; index < doublesPlayerCount; index += 4) {
      courts.push(
        bestCourtPairing(
          activePlayers.slice(index, index + 4).map((player) => player.id),
          courts.length + 1,
          context,
        ),
      );
    }

    if (singlesCourtCount === 1) {
      const singlesPair = activePlayers.slice(doublesPlayerCount, doublesPlayerCount + 2);
      courts.push({
        courtNumber: courts.length + 1,
        team1: [singlesPair[0].id],
        team2: [singlesPair[1].id],
        matchType: "singles",
      });
    }

    const candidate = { courts, sitting };
    const breakdown = scoreRound(candidate, {
      ...context,
      tieBreak: random.next() * config.tieBreakMaximum,
    });
    pool.add(candidate, breakdown);
  }

  const chosen = pool.select(random);

  return {
    ok: true,
    value: {
      ...chosen.candidate,
      seed,
      score: chosen.breakdown.total,
      scoreBreakdown: chosen.breakdown,
    },
  };
}
