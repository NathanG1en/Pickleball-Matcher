import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import {
  pairKey,
  scoreOpponentPair,
  scorePartnerPair,
} from "@/lib/matchmaking/pairs";
import type { PairHistory } from "@/lib/matchmaking/types";

function history(overrides: Partial<PairHistory> = {}): PairHistory {
  return {
    player1Id: "a",
    player2Id: "b",
    sessionPartnerCount: 0,
    sessionOpponentCount: 0,
    roundsSincePartner: null,
    roundsSinceOpponent: null,
    lifetimePartnerCount: 0,
    lifetimeOpponentCount: 0,
    ...overrides,
  };
}

describe("pairKey", () => {
  it("is independent of player order", () => {
    expect(pairKey("player-b", "player-a")).toBe(pairKey("player-a", "player-b"));
  });
});

describe("pair penalties", () => {
  it("penalizes a last-round partnership more than an older one", () => {
    const recent = scorePartnerPair(
      history({ sessionPartnerCount: 1, roundsSincePartner: 1 }),
      DEFAULT_MATCHMAKING_CONFIG,
    );
    const older = scorePartnerPair(
      history({ sessionPartnerCount: 1, roundsSincePartner: 5 }),
      DEFAULT_MATCHMAKING_CONFIG,
    );

    expect(recent).toBeGreaterThan(older);
  });

  it("penalizes an equivalent partnership more than an opponent repeat", () => {
    const repeated = history({
      sessionPartnerCount: 1,
      sessionOpponentCount: 1,
      roundsSincePartner: 1,
      roundsSinceOpponent: 1,
    });

    expect(scorePartnerPair(repeated, DEFAULT_MATCHMAKING_CONFIG)).toBeGreaterThan(
      scoreOpponentPair(repeated, DEFAULT_MATCHMAKING_CONFIG),
    );
  });

  it("lets session frequency dominate much larger lifetime frequency", () => {
    const onceTonight = scorePartnerPair(
      history({ sessionPartnerCount: 1 }),
      DEFAULT_MATCHMAKING_CONFIG,
    );
    const longAgo = scorePartnerPair(
      history({ lifetimePartnerCount: 12 }),
      DEFAULT_MATCHMAKING_CONFIG,
    );

    expect(onceTonight).toBeGreaterThan(longAgo);
  });

  it("assigns no penalty to players with no shared history", () => {
    expect(scorePartnerPair(history(), DEFAULT_MATCHMAKING_CONFIG)).toBe(0);
    expect(scoreOpponentPair(history(), DEFAULT_MATCHMAKING_CONFIG)).toBe(0);
  });
});
