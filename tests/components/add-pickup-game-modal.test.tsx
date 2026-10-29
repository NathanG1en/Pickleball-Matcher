import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AddPickupGameModal,
  computePlayerAvailability,
  swapPickupSlot,
  type PickupSlotState,
} from "@/components/sessions/add-pickup-game-modal";
import type { PlayerRecord, AttendanceRecord, StartedRoundRecord } from "@/lib/domain/types";

describe("AddPickupGameModal Component", () => {
  const samplePlayers: PlayerRecord[] = [
    { id: "p1", groupId: "g1", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p2", groupId: "g1", name: "Bob", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p3", groupId: "g1", name: "Charlie", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p4", groupId: "g1", name: "Diana", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p5", groupId: "g1", name: "Evan", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
  ];

  const sampleAttendance: AttendanceRecord[] = [
    { sessionId: "ses_1", playerId: "p1", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p2", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p3", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p4", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p5", joinedRound: 1, leftRound: null },
  ];

  const sampleActiveRound: StartedRoundRecord = {
    round: {
      id: "rnd_1",
      sessionId: "ses_1",
      roundNumber: 1,
      status: "started",
      seed: 42,
      scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
      version: 1,
    },
    matches: [
      {
        id: "m1",
        roundId: "rnd_1",
        courtNumber: 1,
        team1Score: 11,
        team2Score: 9,
        status: "completed",
        completedAt: new Date(),
        version: 1,
      },
      {
        id: "m2",
        roundId: "rnd_1",
        courtNumber: 2,
        team1Score: null,
        team2Score: null,
        status: "pending",
        completedAt: null,
        version: 1,
      },
    ],
    matchPlayers: [
      { matchId: "m1", playerId: "p1", team: 1, ratingBefore: 1000, ratingAfter: null },
      { matchId: "m1", playerId: "p2", team: 2, ratingBefore: 1000, ratingAfter: null },
      { matchId: "m2", playerId: "p3", team: 1, ratingBefore: 1000, ratingAfter: null },
      { matchId: "m2", playerId: "p4", team: 2, ratingBefore: 1000, ratingAfter: null },
    ],
    sits: [
      { roundId: "rnd_1", playerId: "p5" },
    ],
  };

  it("renders modal with title and without interim game label", () => {
    const html = renderToStaticMarkup(
      <AddPickupGameModal
        isOpen={true}
        onClose={vi.fn()}
        groupId="g1"
        sessionId="ses_1"
        players={samplePlayers}
        attendance={sampleAttendance}
        activeRound={sampleActiveRound}
        courtCount={2}
        onSuccess={vi.fn()}
      />
    );

    expect(html).toContain("Add Pickup Game");
    expect(html).not.toContain("Interim Game");
    expect(html).toContain("Doubles (2v2)");
    expect(html).toContain("Singles (1v1)");
    expect(html).toContain("Team 1 Points");
    expect(html).toContain("Team 2 Points");
    expect(html).toContain("Count toward player ratings");
  });

  it("computes player availability accurately for sitting, finished, and currently playing players", () => {
    const availability = computePlayerAvailability(sampleActiveRound);

    // p5 is sitting out
    expect(availability.sitting.has("p5")).toBe(true);
    // p1 & p2 finished their match on Court 1
    expect(availability.finished.has("p1")).toBe(true);
    expect(availability.finished.has("p2")).toBe(true);
    // p3 & p4 are currently playing on Court 2
    expect(availability.playing.get("p3")).toBe(2);
    expect(availability.playing.get("p4")).toBe(2);
  });

  it("swaps players between slots when a player already selected in another slot is chosen", () => {
    const initial: PickupSlotState = {
      t1p1: "p1",
      t1p2: "p2",
      t2p1: "p3",
      t2p2: "p4",
    };

    // Selecting p3 for t1p1 should swap p1 and p3
    const swapped = swapPickupSlot(initial, "t1p1", "p3");
    expect(swapped.t1p1).toBe("p3");
    expect(swapped.t2p1).toBe("p1");
    expect(swapped.t1p2).toBe("p2");
    expect(swapped.t2p2).toBe("p4");
  });

  it("moves a player to an empty slot and vacates their previous slot", () => {
    const initial: PickupSlotState = {
      t1p1: "p1",
      t1p2: "p2",
      t2p1: "p3",
      t2p2: "",
    };

    // Selecting p1 for t2p2 should put p1 in t2p2 and vacate t1p1
    const moved = swapPickupSlot(initial, "t2p2", "p1");
    expect(moved.t2p2).toBe("p1");
    expect(moved.t1p1).toBe("");
    expect(moved.t1p2).toBe("p2");
    expect(moved.t2p1).toBe("p3");
  });

  it("assigns a new player to an empty slot without disturbing other slots", () => {
    const initial: PickupSlotState = {
      t1p1: "p1",
      t1p2: "",
      t2p1: "p3",
      t2p2: "",
    };

    const updated = swapPickupSlot(initial, "t1p2", "p5");
    expect(updated.t1p2).toBe("p5");
    expect(updated.t1p1).toBe("p1");
    expect(updated.t2p1).toBe("p3");
  });

  it("clears a slot when empty string is passed", () => {
    const initial: PickupSlotState = {
      t1p1: "p1",
      t1p2: "p2",
      t2p1: "p3",
      t2p2: "p4",
    };

    const cleared = swapPickupSlot(initial, "t1p1", "");
    expect(cleared.t1p1).toBe("");
    expect(cleared.t1p2).toBe("p2");
  });

  it("does not render when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <AddPickupGameModal
        isOpen={false}
        onClose={vi.fn()}
        groupId="g1"
        sessionId="ses_1"
        players={samplePlayers}
        attendance={sampleAttendance}
        activeRound={sampleActiveRound}
        courtCount={2}
        onSuccess={vi.fn()}
      />
    );

    expect(html).not.toContain("Add Pickup Game");
  });

  it("computes player availability based on activeProposal when activeRound is not started", () => {
    const sampleProposal = {
      roundNumber: 1,
      seed: 123,
      score: 0,
      courts: [
        { courtNumber: 1, team1: ["p1", "p2"] as [string, string], team2: ["p3", "p4"] as [string, string] },
      ],
      sitting: ["p5"],
      scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
    };

    const availability = computePlayerAvailability(null, sampleProposal);
    expect(availability.sitting.has("p5")).toBe(true);
    expect(availability.playing.get("p1")).toBe(1);
    expect(availability.playing.get("p2")).toBe(1);
    expect(availability.playing.get("p3")).toBe(1);
    expect(availability.playing.get("p4")).toBe(1);
    expect(availability.finished.size).toBe(0);

    const html = renderToStaticMarkup(
      <AddPickupGameModal
        isOpen={true}
        onClose={vi.fn()}
        groupId="g1"
        sessionId="ses_1"
        players={samplePlayers}
        attendance={sampleAttendance}
        activeRound={null}
        activeProposal={sampleProposal}
        courtCount={1}
        onSuccess={vi.fn()}
      />
    );
    expect(html).toContain("Add Pickup Game");
  });
});
