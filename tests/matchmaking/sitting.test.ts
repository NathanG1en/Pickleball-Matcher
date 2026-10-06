import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { createSeededRandom } from "@/lib/matchmaking/random";
import {
  chooseSittingPlayers,
  participationLoad,
  scoreSittingChoice,
} from "@/lib/matchmaking/sitting";
import { makePlayer } from "@/test-support/factories";

function group(size: number) {
  return Array.from({ length: size }, (_, index) =>
    makePlayer({
      id: `player-${index + 1}`,
      gamesPlayed: 3,
      eligibleRounds: 4,
    }),
  );
}

describe("participationLoad", () => {
  it("uses one group-average prior opportunity for a new arrival", () => {
    const lateArrival = makePlayer({ gamesPlayed: 0, eligibleRounds: 0 });

    expect(participationLoad(lateArrival, 0.75)).toBe(0.75);
  });
});

describe("chooseSittingPlayers", () => {
  it("selects two players with the greatest participation advantage for 14 players and 3 courts", () => {
    const players = group(14).map((player, index) =>
      index >= 12 ? { ...player, gamesPlayed: 4 } : player,
    );

    const sitting = chooseSittingPlayers({
      players,
      sitCount: 2,
      random: createSeededRandom(7),
      config: DEFAULT_MATCHMAKING_CONFIG,
    });

    expect(new Set(sitting)).toEqual(new Set(["player-13", "player-14"]));
  });

  it("avoids a consecutive sit when an equally loaded alternative exists", () => {
    const players = group(5).map((player, index) => ({
      ...player,
      gamesPlayed: index < 2 ? 4 : 3,
      satPreviousRound: index === 0,
    }));

    const sitting = chooseSittingPlayers({
      players,
      sitCount: 1,
      random: createSeededRandom(11),
      config: DEFAULT_MATCHMAKING_CONFIG,
    });

    expect(sitting).toEqual(["player-2"]);
  });

  it("allows a consecutive sit when every option is unavoidable", () => {
    const players = group(5).map((player) => ({ ...player, satPreviousRound: true }));

    const sitting = chooseSittingPlayers({
      players,
      sitCount: 1,
      random: createSeededRandom(3),
      config: DEFAULT_MATCHMAKING_CONFIG,
    });

    expect(sitting).toHaveLength(1);
    expect(players.map((player) => player.id)).toContain(sitting[0]);
  });

  it("is deterministic for tied players and the same seed", () => {
    const players = group(8);
    const select = () =>
      chooseSittingPlayers({
        players,
        sitCount: 2,
        random: createSeededRandom(44),
        config: DEFAULT_MATCHMAKING_CONFIG,
      });

    expect(select()).toEqual(select());
  });

  it("does not mutate player input", () => {
    const players = group(7);
    const snapshot = structuredClone(players);

    chooseSittingPlayers({
      players,
      sitCount: 3,
      random: createSeededRandom(21),
      config: DEFAULT_MATCHMAKING_CONFIG,
    });

    expect(players).toEqual(snapshot);
  });

  it("does not always force a new arrival to play or to sit when everyone is otherwise tied", () => {
    const established = group(4);
    const lateArrival = makePlayer({ id: "late", gamesPlayed: 0, eligibleRounds: 0 });
    const outcomes = new Set<boolean>();

    for (let seed = 1; seed <= 30; seed += 1) {
      const sitting = chooseSittingPlayers({
        players: [...established, lateArrival],
        sitCount: 1,
        random: createSeededRandom(seed),
        config: DEFAULT_MATCHMAKING_CONFIG,
      });
      outcomes.add(sitting.includes("late"));
    }

    expect(outcomes).toEqual(new Set([true, false]));
  });
});

describe("scoreSittingChoice", () => {
  it("reports projected participation spread and consecutive-sit share", () => {
    const players = group(5).map((player, index) => ({
      ...player,
      satPreviousRound: index === 0,
    }));

    const score = scoreSittingChoice({ players, sitting: ["player-1"] });

    expect(score.playingTime).toBeGreaterThan(0);
    expect(score.consecutiveSit).toBe(1);
  });
});
