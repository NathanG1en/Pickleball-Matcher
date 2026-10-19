import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSessionAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { SessionRecord, PlayerRecord, StartedRoundRecord } from "@/lib/domain/types";

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

describe("deleteSessionAction", () => {
  let repository: InMemoryRepositories;

  const samplePlayers: PlayerRecord[] = [
    { id: "p1", groupId: "g1", name: "Player 1", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p2", groupId: "g1", name: "Player 2", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p3", groupId: "g1", name: "Player 3", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
    { id: "p4", groupId: "g1", name: "Player 4", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
  ];

  const sampleSession: SessionRecord = {
    id: "ses_1",
    groupId: "g1",
    courtCount: 1,
    status: "active",
    currentRoundNumber: 1,
    startedAt: new Date("2026-10-10T10:00:00Z"),
    endedAt: null,
    version: 1,
    type: "regular",
    name: "Morning Games",
  };

  const sampleRound: StartedRoundRecord = {
    round: {
      id: "rnd_1",
      sessionId: "ses_1",
      roundNumber: 1,
      status: "completed",
      seed: 1234,
      scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
      createdAt: new Date("2026-10-10T10:05:00Z"),
      startedAt: new Date("2026-10-10T10:05:00Z"),
      completedAt: new Date("2026-10-10T10:20:00Z"),
      version: 1,
    },
    matches: [
      {
        id: "m_1",
        roundId: "rnd_1",
        courtNumber: 1,
        status: "completed",
        team1Score: 11,
        team2Score: 9,
        completedAt: new Date("2026-10-10T10:20:00Z"),
        version: 1,
      },
    ],
    matchPlayers: [
      { matchId: "m_1", playerId: "p1", team: 1, ratingBefore: null, ratingAfter: null },
      { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: null, ratingAfter: null },
      { matchId: "m_1", playerId: "p3", team: 2, ratingBefore: null, ratingAfter: null },
      { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: null, ratingAfter: null },
    ],
    sits: [],
  };

  beforeEach(() => {
    mockOrganizerAllowed = true;
    repository = new InMemoryRepositories({
      groups: [{ id: "g1", name: "Pickle Club", organizerPinHash: "pin", createdAt: new Date() }],
      players: samplePlayers,
      sessions: [structuredClone(sampleSession)],
      rounds: [structuredClone(sampleRound.round)],
      matches: [...structuredClone(sampleRound.matches)],
      matchPlayers: [...structuredClone(sampleRound.matchPlayers)],
      attendance: [
        { sessionId: "ses_1", playerId: "p1", joinedRound: 1, leftRound: null },
        { sessionId: "ses_1", playerId: "p2", joinedRound: 1, leftRound: null },
      ],
    });
    setActionRepository(repository);
  });

  it("deletes a session and its associated rounds, matches, and attendance", async () => {
    const res = await deleteSessionAction({
      groupId: "g1",
      sessionId: "ses_1",
    });

    expect(res.ok).toBe(true);

    const session = await repository.getSession("ses_1");
    expect(session).toBeNull();

    const attendance = await repository.listAttendance("ses_1");
    expect(attendance).toHaveLength(0);

    const rounds = await repository.listStartedRounds("ses_1");
    expect(rounds).toHaveLength(0);
  });

  it("rejects deletion when caller is not an organizer", async () => {
    mockOrganizerAllowed = false;

    const res = await deleteSessionAction({
      groupId: "g1",
      sessionId: "ses_1",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Organizer authorization required");
    }

    // Session still exists
    const session = await repository.getSession("ses_1");
    expect(session).not.toBeNull();
  });

  it("returns error if session does not exist", async () => {
    const res = await deleteSessionAction({
      groupId: "g1",
      sessionId: "non_existent",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Session not found.");
    }
  });

  it("returns error if session belongs to another group", async () => {
    const res = await deleteSessionAction({
      groupId: "g_other",
      sessionId: "ses_1",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Session not found.");
    }
  });
});
