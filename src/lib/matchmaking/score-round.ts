import {
  buildPairHistoryIndex,
  emptyPairHistory,
  pairKey,
  scoreOpponentPair,
  scorePartnerPair,
} from "@/lib/matchmaking/pairs";
import type {
  CourtAssignment,
  MatchmakingPlayer,
  PairHistory,
  PlayerId,
  RoundCandidate,
  RoundScoringContext,
  ScoreBreakdown,
} from "@/lib/matchmaking/types";

function playerIndex(players: readonly MatchmakingPlayer[]): ReadonlyMap<PlayerId, MatchmakingPlayer> {
  return new Map(players.map((player) => [player.id, player]));
}

function requiredPlayer(
  players: ReadonlyMap<PlayerId, MatchmakingPlayer>,
  playerId: PlayerId,
): MatchmakingPlayer {
  const player = players.get(playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  return player;
}

export function scoreSkillBalance(
  court: CourtAssignment,
  players: readonly MatchmakingPlayer[],
): number {
  const indexed = playerIndex(players);
  const team1 =
    court.team1.length === 1
      ? requiredPlayer(indexed, court.team1[0]).rating
      : (requiredPlayer(indexed, court.team1[0]).rating +
          requiredPlayer(indexed, court.team1[1]).rating) /
        2;
  const team2 =
    court.team2.length === 1
      ? requiredPlayer(indexed, court.team2[0]).rating
      : (requiredPlayer(indexed, court.team2[0]).rating +
          requiredPlayer(indexed, court.team2[1]).rating) /
        2;
  return Math.abs(team1 - team2);
}

function historyFor(
  history: ReadonlyMap<string, PairHistory>,
  player1Id: PlayerId,
  player2Id: PlayerId,
): PairHistory {
  return history.get(pairKey(player1Id, player2Id)) ?? emptyPairHistory(player1Id, player2Id);
}

function candidatePairPenalties(
  candidate: RoundCandidate,
  context: RoundScoringContext,
): { partner: number; opponent: number } {
  const indexedHistory = Array.isArray(context.pairHistory)
    ? buildPairHistoryIndex(context.pairHistory)
    : (context.pairHistory as ReadonlyMap<string, PairHistory>);
  let partner = 0;
  let opponent = 0;

  for (const court of candidate.courts) {
    if (court.team1.length === 2) {
      const [p1, p2] = court.team1;
      if (!context.stayTogetherPairs?.some(([a, b]) => (a === p1 && b === p2) || (a === p2 && b === p1))) partner += scorePartnerPair(
        historyFor(indexedHistory, p1, p2),
        context.config,
      );
    }
    if (court.team2.length === 2) {
      const [p1, p2] = court.team2;
      if (!context.stayTogetherPairs?.some(([a, b]) => (a === p1 && b === p2) || (a === p2 && b === p1))) partner += scorePartnerPair(
        historyFor(indexedHistory, p1, p2),
        context.config,
      );
    }

    for (const team1Player of court.team1) {
      for (const team2Player of court.team2) {
        opponent += scoreOpponentPair(
          historyFor(indexedHistory, team1Player, team2Player),
          context.config,
        );
      }
    }
  }

  return { partner, opponent };
}

export function scoreRound(
  candidate: RoundCandidate,
  context: RoundScoringContext,
): ScoreBreakdown {
  const courtCount = Math.max(candidate.courts.length, 1);
  const pairPenalties = candidatePairPenalties(candidate, context);
  const averageSkillDifference =
    candidate.courts.reduce(
      (total, court) => total + scoreSkillBalance(court, context.players),
      0,
    ) / courtCount;

  const playingTime = context.sittingPenalty.playingTime * context.config.weights.playingTime;
  const consecutiveSit =
    context.sittingPenalty.consecutiveSit * context.config.weights.consecutiveSit;
  const partnerRepeat =
    (pairPenalties.partner / (courtCount * 2 * 100)) * context.config.weights.partnerRepeat;
  const skillBalance =
    (averageSkillDifference / 400) * context.config.weights.skillBalance;
  const opponentRepeat =
    (pairPenalties.opponent / (courtCount * 4 * 25)) * context.config.weights.opponentRepeat;

  const twoVsOneWeight = context.config.weights.twoVsOneRepeat ?? 100;
  let twoVsOneRepeat = 0;
  const indexedPlayers = playerIndex(context.players);
  for (const court of candidate.courts) {
    const isTwoVsOne =
      court.matchType === "team-vs-one" ||
      court.team1.length + court.team2.length === 3;
    if (isTwoVsOne) {
      const playersOnCourt = [...court.team1, ...court.team2];
      for (const playerId of playersOnCourt) {
        const player = indexedPlayers.get(playerId);
        const count = player?.timesPlayed2v1 ?? 0;
        if (count > 0) {
          twoVsOneRepeat += count * count * twoVsOneWeight;
        }
      }
    }
  }

  const tieBreak = context.tieBreak;

  return {
    playingTime,
    consecutiveSit,
    partnerRepeat,
    skillBalance,
    opponentRepeat,
    twoVsOneRepeat,
    tieBreak,
    total:
      playingTime +
      consecutiveSit +
      partnerRepeat +
      skillBalance +
      opponentRepeat +
      twoVsOneRepeat +
      tieBreak,
  };
}
