import { beforeEach, describe, expect, it, vi } from "vitest";
import { reshuffleRoundAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { SessionRecord, PlayerRecord, RoundRecord, MatchRecord, MatchPlayerRecord } from "@/lib/domain/types";

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

describe("reshuffleRoundAction", () => {
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

  const sampleMatch: MatchRecord = {
    id: "m_1",
    roundId: "rnd_1",
    courtNumber: 1,
    team1Score: null,
    team2Score: null,
    status: "pending",
    completedAt: null,
    version: 1,
  };

  const sampleMatchPlayers: MatchPlayerRecord[] = [
    { matchId: "m_1", playerId: "p1", team: 1, ratingBefore: 1000, ratingAfter: 1000 },
    { matchId: "m_1", playerId: "p2", team: 1, ratingBefore: 1000, ratingAfter: 1000 },
    { matchId: "m_1", playerId: "p3", team: 2, ratingBefore: 1000, ratingAfter: 1000 },
    { matchId: "m_1", playerId: "p4", team: 2, ratingBefore: 1000, ratingAfter: 1000 },
  ];

  beforeEach(() => {
    mockOrganizerAllowed = true;
    repository = new InMemoryRepositories();
    for (const player of samplePlayers) {
      repository.state.players.push(player);
    }
    repository.state.sessions.push({ ...sampleSession });
    repository.state.rounds.push({ ...sampleRound });
    repository.state.matches.push({ ...sampleMatch });
    for (const mp of sampleMatchPlayers) {
      repository.state.matchPlayers.push({ ...mp });
    }
    for (const player of samplePlayers) {
      repository.state.attendance.push({
        sessionId: "ses_1",
        playerId: player.id,
        joinedRound: 1,
        leftRound: null,
      });
    }
    setActionRepository(repository);
  });

  it("reshuffles round matchups when user is an organizer", async () => {
    const res = await reshuffleRoundAction({
      groupId: "g1",
      sessionId: "ses_1",
      sessionVersion: 1,
      roundId: "rnd_1",
      roundVersion: 1,
      seed: 99999,
      idempotencyKey: "test_key",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.courts.length).toBe(1);
    expect(repository.state.rounds.some((r) => r.id === "rnd_1")).toBe(false);
  });

  it("fails when user is not an organizer", async () => {
    mockOrganizerAllowed = false;
    const res = await reshuffleRoundAction({
      groupId: "g1",
      sessionId: "ses_1",
      sessionVersion: 1,
      roundId: "rnd_1",
      roundVersion: 1,
      seed: 99999,
      idempotencyKey: "test_key",
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe("Organizer authorization required.");
  });
});
