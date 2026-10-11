import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTournamentAction,
  deleteTournamentAction,
  editTournamentSlotAction,
  reshuffleTournamentDivisionAction,
  swapTournamentSlotsAction,
  updateTournamentMatchAction,
  updateTournamentNameAction,
  updateTournamentStatusAction,
} from "@/app/actions/tournaments";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requireOrganizer: vi.fn(async () => null),
  };
});

describe("Tournament Server Actions", () => {
  let repository: InMemoryRepositories;

  const samplePlayers = [
    { id: "p1", groupId: "g1", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "female" as const },
    { id: "p2", groupId: "g1", name: "Bob", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" as const },
    { id: "p3", groupId: "g1", name: "Charlie", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" as const },
    { id: "p4", groupId: "g1", name: "Dana", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "female" as const },
  ];

  beforeEach(() => {
    repository = new InMemoryRepositories({
      groups: [{ id: "g1", name: "Summer Club", organizerPinHash: "pin", createdAt: new Date() }],
      players: samplePlayers,
      tournaments: [],
    });
    setActionRepository(repository);
  });

  it("creates a tournament with selected divisions and randomized brackets", async () => {
    const res = await createTournamentAction({
      groupId: "g1",
      name: "Fall Slam",
      divisions: ["mens_singles", "womens_singles", "mixed_doubles"],
      playerIds: ["p1", "p2", "p3", "p4"],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const tourney = res.data;
    expect(tourney.name).toBe("Fall Slam");
    expect(tourney.status).toBe("active");
    expect(tourney.divisions).toEqual(["mens_singles", "womens_singles", "mixed_doubles"]);

    // Verify brackets exist
    expect(tourney.brackets["mens_singles"]).toBeDefined();
    expect(tourney.brackets["womens_singles"]).toBeDefined();
    expect(tourney.brackets["mixed_doubles"]).toBeDefined();

    const mensBracket = tourney.brackets["mens_singles"]!;
    expect(mensBracket.participants.length).toBe(2); // Bob & Charlie
    expect(mensBracket.matches.length).toBe(1); // 1 match (Finals)
  });

  it("updates match score and advances winner to downstream match", async () => {
    const createRes = await createTournamentAction({
      groupId: "g1",
      name: "Test Tourney",
      divisions: ["mens_singles"],
      playerIds: ["p2", "p3"],
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const tourney = createRes.data;
    const match = tourney.brackets["mens_singles"]!.matches[0]!;

    const updateRes = await updateTournamentMatchAction({
      tournamentId: tourney.id,
      groupId: "g1",
      division: "mens_singles",
      matchId: match.id,
      winnerId: match.participant1Id,
      score1: 11,
      score2: 8,
    });

    expect(updateRes.ok).toBe(true);
    if (!updateRes.ok) return;

    const updatedMatch = updateRes.data.brackets["mens_singles"]!.matches[0]!;
    expect(updatedMatch.winnerId).toBe(match.participant1Id);
    expect(updatedMatch.score1).toBe(11);
    expect(updatedMatch.score2).toBe(8);
    expect(updatedMatch.status).toBe("completed");
  });

  it("swaps participant slots in a match", async () => {
    const createRes = await createTournamentAction({
      groupId: "g1",
      name: "Swap Tourney",
      divisions: ["mens_singles"],
      playerIds: ["p2", "p3"],
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const tourney = createRes.data;
    const match = tourney.brackets["mens_singles"]!.matches[0]!;
    const originalP1 = match.participant1Id;
    const originalP2 = match.participant2Id;

    const swapRes = await swapTournamentSlotsAction({
      tournamentId: tourney.id,
      groupId: "g1",
      division: "mens_singles",
      match1Id: match.id,
      slot1: 1,
      match2Id: match.id,
      slot2: 2,
    });

    expect(swapRes.ok).toBe(true);
    if (!swapRes.ok) return;

    const swappedMatch = swapRes.data.brackets["mens_singles"]!.matches[0]!;
    expect(swappedMatch.participant1Id).toBe(originalP2);
    expect(swappedMatch.participant2Id).toBe(originalP1);
  });

  it("edits a participant slot directly", async () => {
    const createRes = await createTournamentAction({
      groupId: "g1",
      name: "Edit Slot Tourney",
      divisions: ["mens_singles"],
      playerIds: ["p2", "p3"],
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const tourney = createRes.data;
    const match = tourney.brackets["mens_singles"]!.matches[0]!;

    const editRes = await editTournamentSlotAction({
      tournamentId: tourney.id,
      groupId: "g1",
      division: "mens_singles",
      matchId: match.id,
      slot: 1,
      newParticipantId: "custom_p",
    });

    expect(editRes.ok).toBe(true);
    if (!editRes.ok) return;

    const editedMatch = editRes.data.brackets["mens_singles"]!.matches[0]!;
    expect(editedMatch.participant1Id).toBe("custom_p");
  });

  it("reshuffles division matchups", async () => {
    const createRes = await createTournamentAction({
      groupId: "g1",
      name: "Reshuffle Tourney",
      divisions: ["mens_singles"],
      playerIds: ["p2", "p3"],
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const tourney = createRes.data;
    const reshuffleRes = await reshuffleTournamentDivisionAction({
      tournamentId: tourney.id,
      groupId: "g1",
      division: "mens_singles",
    });

    expect(reshuffleRes.ok).toBe(true);
    if (!reshuffleRes.ok) return;
    expect(reshuffleRes.data.brackets["mens_singles"]!.matches.length).toBe(1);
  });

  it("updates tournament name and status", async () => {
    const createRes = await createTournamentAction({
      groupId: "g1",
      name: "Old Name",
      divisions: ["mens_singles"],
      playerIds: ["p2", "p3"],
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const tourney = createRes.data;

    const renameRes = await updateTournamentNameAction({
      tournamentId: tourney.id,
      groupId: "g1",
      name: "New Name",
    });
    expect(renameRes.ok).toBe(true);
    if (renameRes.ok) {
      expect(renameRes.data.name).toBe("New Name");
    }

    const statusRes = await updateTournamentStatusAction({
      tournamentId: tourney.id,
      groupId: "g1",
      status: "completed",
    });
    expect(statusRes.ok).toBe(true);
    if (statusRes.ok) {
      expect(statusRes.data.status).toBe("completed");
    }
  });

  it("deletes a tournament", async () => {
    const createRes = await createTournamentAction({
      groupId: "g1",
      name: "To Delete",
      divisions: ["mens_singles"],
      playerIds: ["p2", "p3"],
    });
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const tourney = createRes.data;
    const deleteRes = await deleteTournamentAction({
      tournamentId: tourney.id,
      groupId: "g1",
    });
    expect(deleteRes.ok).toBe(true);

    const check = await repository.getTournament(tourney.id);
    expect(check).toBeNull();
  });
});

