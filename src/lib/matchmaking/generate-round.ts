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

function stableInputSeed(players: readonly MatchmakingPlayer[], courts: number): number {
  let hash = 0x811c9dc5;
  const value = `${courts}|${players
    .map((player) => `${player.id}:${player.gamesPlayed}:${player.eligibleRounds}`)
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

function betterScore(candidate: ScoreBreakdown, current: ScoreBreakdown | null): boolean {
  if (!current) return true;
  return candidate.total < current.total;
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

  const config = input.config ?? DEFAULT_MATCHMAKING_CONFIG;
  const seed = input.seed ?? stableInputSeed(input.players, input.courts);
  const random = createSeededRandom(seed);
  const doublesCourtCount = Math.min(Math.floor(input.players.length / 4), input.courts);
  const leftoverPlayers = input.players.length - doublesCourtCount * 4;
  const remainingCourts = input.courts - doublesCourtCount;
  const singlesCourtCount =
    allowSingles && leftoverPlayers >= 2 && remainingCourts >= 1 ? 1 : 0;
  const totalActivePlayers = doublesCourtCount * 4 + singlesCourtCount * 2;
  const sitCount = input.players.length - totalActivePlayers;
  const pairHistory = buildPairHistoryIndex(input.pairHistory);
  let bestCandidate: RoundCandidate | null = null;
  let bestBreakdown: ScoreBreakdown | null = null;

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
    if (betterScore(breakdown, bestBreakdown)) {
      bestCandidate = candidate;
      bestBreakdown = breakdown;
    }
  }

  if (!bestCandidate || !bestBreakdown) {
    throw new Error("Matchmaking configuration must evaluate at least one candidate");
  }

  return {
    ok: true,
    value: {
      ...bestCandidate,
      seed,
      score: bestBreakdown.total,
      scoreBreakdown: bestBreakdown,
    },
  };
}
