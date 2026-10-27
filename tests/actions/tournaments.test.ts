import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addTeamTournamentLineAction,
  createTeamTournamentAction,
  createTournamentAction,
  deleteTournamentAction,
  editTournamentSlotAction,
  reshuffleTournamentDivisionAction,
  swapTournamentSlotsAction,
  updateTeamTournamentLineAction,
  updateTournamentMatchAction,
  updateTournamentNameAction,
  updateTournamentStatusAction,
} from "@/app/actions/tournaments";
import { generateBracket, setMatchWinner } from "@/lib/tournament/bracket";
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

  it("does not persist a premature final winner", async () => {
    const bracket = generateBracket("mens_singles", ["a", "b", "c"].map((id) => ({ id, name: id, playerIds: [id] })), { randomize: false });
    await repository.createTournament({
      id: "tr_pending", groupId: "g1", name: "Pending final", status: "active",
      divisions: ["mens_singles"], brackets: { mens_singles: bracket },
      createdAt: new Date(), updatedAt: new Date(),
    });
    const final = bracket.matches.find((match) => match.round === 2)!;
    const result = await updateTournamentMatchAction({
      tournamentId: "tr_pending", groupId: "g1", division: "mens_singles",
      matchId: final.id, winnerId: "a",
    });
    expect(result).toEqual({ ok: false, error: "Both participants must be known before recording a winner" });
    expect((await repository.getTournament("tr_pending"))?.brackets.mens_singles?.matches.find((match) => match.id === final.id)?.winnerId).toBeNull();
  });

  it("persists a cleared final after correcting a semifinal winner", async () => {
    let bracket = generateBracket("mens_singles", samplePlayers.map((player) => ({
      id: player.id, name: player.name, playerIds: [player.id],
    })), { randomize: false });
    bracket = setMatchWinner(bracket, "mens_singles_r1_m1", "p1", { score1: 11, score2: 5 });
    bracket = setMatchWinner(bracket, "mens_singles_r1_m2", "p3", { score1: 11, score2: 6 });
    bracket = setMatchWinner(bracket, "mens_singles_r2_m1", "p1", { score1: 11, score2: 3 });
    await repository.createTournament({
      id: "tr_correction", groupId: "g1", name: "Correction regression", status: "active",
      divisions: ["mens_singles"], brackets: { mens_singles: bracket },
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await updateTournamentMatchAction({
      tournamentId: "tr_correction", groupId: "g1", division: "mens_singles",
      matchId: "mens_singles_r1_m1", winnerId: "p2", score1: 5, score2: 11,
    });
    expect(result.ok).toBe(true);
    const stored = await repository.getTournament("tr_correction");
    expect(stored?.brackets.mens_singles?.matches[2]).toMatchObject({
      participant1Id: "p2", participant2Id: "p3", winnerId: null,
      score1: null, score2: null, status: "pending",
    });
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

  describe("Team Tournament Actions", () => {
    it("creates a team tournament with pre-formed pairs and solo players", async () => {
      const res = await createTeamTournamentAction({
        groupId: "g1",
        name: "Spring Team Brawl",
        teams: [
          {
            name: "Team Fire 🔥",
            color: "#ef4444",
            pairPlayerIds: [["p1", "p2"]],
            soloPlayerIds: [],
          },
          {
            name: "Team Ice ❄️",
            color: "#3b82f6",
            pairPlayerIds: [["p3", "p4"]],
            soloPlayerIds: [],
          },
        ],
        scoringType: "games_won",
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const tourney = res.data;
      expect(tourney.name).toBe("Spring Team Brawl");
      expect(tourney.format).toBe("team_dual");
      expect(tourney.teamData).toBeDefined();
      expect(tourney.teamData?.teams.length).toBe(2);
      expect(tourney.teamData?.pairs.length).toBe(2);
      expect(tourney.teamData?.lines.length).toBeGreaterThanOrEqual(1);

      const line1 = tourney.teamData!.lines[0]!;
      expect(line1.type).toBe("doubles");
      expect(line1.team1PlayerIds).toEqual(["p1", "p2"]);
      expect(line1.team2PlayerIds).toEqual(["p3", "p4"]);
      expect(line1.status).toBe("pending");
    });

    it("updates line scores and completes a match line", async () => {
      const createRes = await createTeamTournamentAction({
        groupId: "g1",
        name: "Line Scoring Test",
        teams: [
          {
            name: "Team Fire 🔥",
            color: "#ef4444",
            pairPlayerIds: [["p1", "p2"]],
            soloPlayerIds: [],
          },
          {
            name: "Team Ice ❄️",
            color: "#3b82f6",
            pairPlayerIds: [["p3", "p4"]],
            soloPlayerIds: [],
          },
        ],
      });
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) return;

      const tourney = createRes.data;
      const line = tourney.teamData!.lines[0]!;

      const updateRes = await updateTeamTournamentLineAction({
        tournamentId: tourney.id,
        groupId: "g1",
        lineId: line.id,
        team1Score: 11,
        team2Score: 9,
      });

      expect(updateRes.ok).toBe(true);
      if (!updateRes.ok) return;

      const updatedLine = updateRes.data.teamData!.lines[0]!;
      expect(updatedLine.team1Score).toBe(11);
      expect(updatedLine.team2Score).toBe(9);
      expect(updatedLine.status).toBe("completed");
    });

    it("adds a tiebreaker / deciding line to a team tournament", async () => {
      const createRes = await createTeamTournamentAction({
        groupId: "g1",
        name: "Dreambreaker Test",
        teams: [
          {
            name: "Team Fire 🔥",
            color: "#ef4444",
            pairPlayerIds: [["p1", "p2"]],
            soloPlayerIds: [],
          },
          {
            name: "Team Ice ❄️",
            color: "#3b82f6",
            pairPlayerIds: [["p3", "p4"]],
            soloPlayerIds: [],
          },
        ],
      });
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) return;

      const tourney = createRes.data;
      const addRes = await addTeamTournamentLineAction({
        tournamentId: tourney.id,
        groupId: "g1",
        name: "Dreambreaker Singles",
        type: "singles",
        team1PlayerIds: ["p1"],
        team2PlayerIds: ["p3"],
      });

      expect(addRes.ok).toBe(true);
      if (!addRes.ok) return;

      const lines = addRes.data.teamData!.lines;
      expect(lines.length).toBe(2);
      const newLine = lines[1]!;
      expect(newLine.name).toBe("Dreambreaker Singles");
      expect(newLine.type).toBe("singles");
      expect(newLine.team1PlayerIds).toEqual(["p1"]);
      expect(newLine.team2PlayerIds).toEqual(["p3"]);
    });
  });
});

