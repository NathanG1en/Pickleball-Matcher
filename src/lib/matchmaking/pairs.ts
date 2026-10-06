import type {
  MatchmakingConfig,
  PairHistory,
  PlayerId,
} from "@/lib/matchmaking/types";

export function pairKey(a: PlayerId, b: PlayerId): string {
  return JSON.stringify(a <= b ? [a, b] : [b, a]);
}

function recencyPenalty(
  roundsSince: number | null,
  curve: Readonly<Record<number, number>>,
): number {
  if (roundsSince === null) return 0;

  const entries = Object.entries(curve)
    .map(([round, penalty]) => [Number(round), penalty] as const)
    .sort(([first], [second]) => first - second);
  const matching = entries.find(([round]) => roundsSince <= round);
  return matching?.[1] ?? entries.at(-1)?.[1] ?? 0;
}

export function scorePartnerPair(
  history: PairHistory,
  config: MatchmakingConfig,
): number {
  return (
    recencyPenalty(history.roundsSincePartner, config.partnerRecency) +
    history.sessionPartnerCount * 20 +
    history.lifetimePartnerCount * config.longTermPartnerFactor
  );
}

export function scoreOpponentPair(
  history: PairHistory,
  config: MatchmakingConfig,
): number {
  return (
    recencyPenalty(history.roundsSinceOpponent, config.opponentRecency) +
    history.sessionOpponentCount * 5 +
    history.lifetimeOpponentCount * config.longTermOpponentFactor
  );
}

export function buildPairHistoryIndex(
  histories: readonly PairHistory[],
): ReadonlyMap<string, PairHistory> {
  return new Map(
    histories.map((history) => [pairKey(history.player1Id, history.player2Id), history]),
  );
}

export function emptyPairHistory(player1Id: PlayerId, player2Id: PlayerId): PairHistory {
  return {
    player1Id,
    player2Id,
    sessionPartnerCount: 0,
    sessionOpponentCount: 0,
    roundsSincePartner: null,
    roundsSinceOpponent: null,
    lifetimePartnerCount: 0,
    lifetimeOpponentCount: 0,
  };
}
