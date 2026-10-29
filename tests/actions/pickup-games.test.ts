import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitSessionPickupGameAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type {
  SessionRecord,
  PlayerRecord,
  RoundRecord,
  AttendanceRecord,
} from "@/lib/domain/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockOrganizerAllowed = true;

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requireOrganizer: vi.fn(async () => {
      if (!mockOrganizerAllowed) {
        throw new Error("Organizer authorization required.");
      }
      return null;
    }),
  };
});

describe("submitSessionPickupGameAction", () => {
  let repository: InMemoryRepositories;

  const samplePlayers: PlayerRecord[] = [
    { id: "p1", groupId: "g1", name: "Player 1", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p2", groupId: "g1", name: "Player 2", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p3", groupId: "g1", name: "Player 3", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p4", groupId: "g1", name: "Player 4", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p5", groupId: "g1", name: "Player 5", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
  ];

  const sampleAttendance: AttendanceRecord[] = [
    { sessionId: "ses_1", playerId: "p1", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p2", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p3", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p4", joinedRound: 1, leftRound: null },
    { sessionId: "ses_1", playerId: "p5", joinedRound: 1, leftRound: 1 }, // left round 1!
  ];

  const sampleSession: SessionRecord = {
    id: "ses_1",
    groupId: "g1",
    courtCount: 1,
    courtPlayerCounts: [4],
    status: "active",
    currentRoundNumber: 1,
    startedAt: new Date("2026-10-10T10:00:00Z"),
    endedAt: null,
    version: 1,
    type: "regular",
  };

  const sampleRound: RoundRecord = {
    id: "rnd_1",
    sessionId: "ses_1",
    roundNumber: 1,
    status: "started",
    seed: 1234,
    scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
    createdAt: new Date("2026-10-10T10:05:00Z"),
    startedAt: new Date("2026-10-10T10:05:00Z"),
    completedAt: null,
    version: 1,
  };

  beforeEach(() => {
    mockOrganizerAllowed = true;
    repository = new InMemoryRepositories({
      groups: [{ id: "g1", name: "Test Group", organizerPinHash: "hash", createdAt: new Date() }],
      players: samplePlayers,
      sessions: [sampleSession],
      rounds: [sampleRound],
      attendance: sampleAttendance,
      roundSits: [{ roundId: "rnd_1", playerId: "p1" }],
      matches: [
        {
          id: "m_1",
          roundId: "rnd_1",
          courtNumber: 1,
          team1Score: null,
          team2Score: null,
          status: "pending",
          completedAt: null,
          version: 1,
        },
      ],
      matchPlayers: [
        { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: 1000, ratingAfter: null },
        { matchId: "m_1", playerId: "p3", team: 1, ratingBefore: 1000, ratingAfter: null },
        { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: 1000, ratingAfter: null },
      ],
    });
    setActionRepository(repository);
  });

  it("successfully creates a completed pickup game during an active round", async () => {
    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_1",
      team1PlayerIds: ["p1", "p2"],
      team2PlayerIds: ["p3", "p4"],
      team1Score: 11,
      team2Score: 9,
      rated: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Check match created with courtNumber = 2 (since Court 1 already exists)
    expect(result.data.match.courtNumber).toBe(2);
    expect(result.data.match.status).toBe("completed");
    expect(result.data.match.team1Score).toBe(11);
    expect(result.data.match.team2Score).toBe(9);
    expect(result.data.matchPlayers).toHaveLength(4);

    // Verify sitting records are untouched (fairness preserved)
    const sits = repository.state.roundSits.filter((s) => s.roundId === "rnd_1");
    expect(sits).toHaveLength(1);
    expect(sits[0].playerId).toBe("p1");

    // Verify ratings updated since rated was true
    const p1 = repository.state.players.find((p) => p.id === "p1");
    const p3 = repository.state.players.find((p) => p.id === "p3");
    expect(p1?.ratedGamesPlayed).toBe(1);
    expect(p3?.ratedGamesPlayed).toBe(1);
    expect(p1?.rating).toBeGreaterThan(1000); // won game
    expect(p3?.rating).toBeLessThan(1000); // lost game
  });

  it("supports unrated pickup games without altering player ratings", async () => {
    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_1",
      team1PlayerIds: ["p1", "p2"],
      team2PlayerIds: ["p3", "p4"],
      team1Score: 11,
      team2Score: 5,
      rated: false,
    });

    expect(result.ok).toBe(true);
    const p1 = repository.state.players.find((p) => p.id === "p1");
    expect(p1?.ratedGamesPlayed).toBe(0);
    expect(p1?.rating).toBe(1000);
  });

  it("supports singles pickup games (1 vs 1)", async () => {
    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_1",
      team1PlayerIds: ["p1"],
      team2PlayerIds: ["p2"],
      team1Score: 11,
      team2Score: 6,
      rated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.matchPlayers).toHaveLength(2);
  });

  it("rejects player who is not currently checked in / has left", async () => {
    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_1",
      team1PlayerIds: ["p1", "p5"], // p5 has leftRound: 1
      team2PlayerIds: ["p2", "p3"],
      team1Score: 11,
      team2Score: 4,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("must be currently checked in");
  });

  it("rejects non-existent player", async () => {
    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_1",
      team1PlayerIds: ["p1", "p_nonexistent"],
      team2PlayerIds: ["p2", "p3"],
      team1Score: 11,
      team2Score: 4,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("must be currently checked in");
  });

  it("rejects tie scores", async () => {
    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_1",
      team1PlayerIds: ["p1", "p2"],
      team2PlayerIds: ["p3", "p4"],
      team1Score: 11,
      team2Score: 11,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Ties are not allowed");
  });

  it("successfully creates a completed pickup game before any round has started", async () => {
    // New session with currentRoundNumber: 0 and no rounds created yet
    const freshSession: SessionRecord = {
      id: "ses_fresh",
      groupId: "g1",
      courtCount: 1,
      courtPlayerCounts: [4],
      status: "active",
      currentRoundNumber: 0,
      startedAt: new Date("2026-10-10T10:00:00Z"),
      endedAt: null,
      version: 1,
      type: "regular",
    };
    const freshAttendance: AttendanceRecord[] = [
      { sessionId: "ses_fresh", playerId: "p1", joinedRound: 1, leftRound: null },
      { sessionId: "ses_fresh", playerId: "p2", joinedRound: 1, leftRound: null },
      { sessionId: "ses_fresh", playerId: "p3", joinedRound: 1, leftRound: null },
      { sessionId: "ses_fresh", playerId: "p4", joinedRound: 1, leftRound: null },
    ];
    await repository.insertSession(freshSession, freshAttendance);

    const result = await submitSessionPickupGameAction({
      groupId: "g1",
      sessionId: "ses_fresh",
      team1PlayerIds: ["p1", "p2"],
      team2PlayerIds: ["p3", "p4"],
      team1Score: 11,
      team2Score: 7,
      rated: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.match.status).toBe("completed");
    expect(result.data.match.team1Score).toBe(11);
    expect(result.data.match.team2Score).toBe(7);

    // Verify round created is completed with roundNumber 1
    const freshRounds = repository.state.rounds.filter((r) => r.sessionId === "ses_fresh");
    expect(freshRounds).toHaveLength(1);
    expect(freshRounds[0].roundNumber).toBe(1);
    expect(freshRounds[0].status).toBe("completed");
    expect(freshRounds[0].completedAt).not.toBeNull();

    // Verify session currentRoundNumber was advanced to 1
    const updatedSession = repository.state.sessions.find((s) => s.id === "ses_fresh");
    expect(updatedSession?.currentRoundNumber).toBe(1);
  });
});

