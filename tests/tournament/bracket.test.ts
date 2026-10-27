import { describe, expect, it } from "vitest";
import {
  createParticipantsForDivision,
  generateBracket,
  getRoundNames,
  reshuffleBracketMatchups,
  setMatchWinner,
  swapParticipants,
  updateMatchParticipant,
} from "@/lib/tournament/bracket";
import type { PlayerRecord, TournamentParticipant } from "@/lib/domain/types";

describe("Tournament Bracket Utilities", () => {
  const dummyPlayers: PlayerRecord[] = [
    { id: "p1", groupId: "g1", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "female" },
    { id: "p2", groupId: "g1", name: "Bob", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" },
    { id: "p3", groupId: "g1", name: "Charlie", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" },
    { id: "p4", groupId: "g1", name: "Dana", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "female" },
    { id: "p5", groupId: "g1", name: "Evan", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" },
  ];

  it("computes round names properly", () => {
    expect(getRoundNames(1)).toEqual(["Finals"]);
    expect(getRoundNames(2)).toEqual(["Semifinals", "Finals"]);
    expect(getRoundNames(3)).toEqual(["Quarterfinals", "Semifinals", "Finals"]);
    expect(getRoundNames(4)).toEqual(["Round of 16", "Quarterfinals", "Semifinals", "Finals"]);
  });

  it("creates participants for mens and womens singles and doubles and mixed doubles", () => {
    const mensSingles = createParticipantsForDivision("mens_singles", dummyPlayers);
    expect(mensSingles.length).toBe(3); // Bob, Charlie, Evan
    expect(mensSingles.every((p) => p.playerIds.length === 1)).toBe(true);

    const womensSingles = createParticipantsForDivision("womens_singles", dummyPlayers);
    expect(womensSingles.length).toBe(2); // Alice, Dana

    const mensDoubles = createParticipantsForDivision("mens_doubles", dummyPlayers);
    expect(mensDoubles.length).toBe(2); // 1 pair + 1 single or 2 pairs depending on player count

    const mixedDoubles = createParticipantsForDivision("mixed_doubles", dummyPlayers);
    expect(mixedDoubles.length).toBeGreaterThan(0);
    expect(mixedDoubles.some((p) => p.name.includes("&"))).toBe(true);
  });

  it("generates a 4-player bracket correctly with 2 rounds", () => {
    const participants: TournamentParticipant[] = [
      { id: "team1", name: "Team 1", playerIds: ["p1"] },
      { id: "team2", name: "Team 2", playerIds: ["p2"] },
      { id: "team3", name: "Team 3", playerIds: ["p3"] },
      { id: "team4", name: "Team 4", playerIds: ["p4"] },
    ];

    const bracket = generateBracket("mens_singles", participants, { randomize: false });
    expect(bracket.roundNames).toEqual(["Semifinals", "Finals"]);
    expect(bracket.matches.length).toBe(3); // 2 in R1, 1 in R2

    const r1m1 = bracket.matches.find((m) => m.round === 1 && m.matchNumber === 1)!;
    const r1m2 = bracket.matches.find((m) => m.round === 1 && m.matchNumber === 2)!;
    const r2m1 = bracket.matches.find((m) => m.round === 2 && m.matchNumber === 1)!;

    expect(r1m1.participant1Id).toBe("team1");
    expect(r1m1.participant2Id).toBe("team2");
    expect(r1m1.nextMatchId).toBe(r2m1.id);
    expect(r1m1.nextMatchSlot).toBe(1);

    expect(r1m2.participant1Id).toBe("team3");
    expect(r1m2.participant2Id).toBe("team4");
    expect(r1m2.nextMatchId).toBe(r2m1.id);
    expect(r1m2.nextMatchSlot).toBe(2);

    expect(r2m1.participant1Id).toBeNull();
    expect(r2m1.participant2Id).toBeNull();
  });

  it("handles byes when participants count is not a power of 2 (e.g. 3 players)", () => {
    const participants: TournamentParticipant[] = [
      { id: "team1", name: "Team 1", playerIds: ["p1"] },
      { id: "team2", name: "Team 2", playerIds: ["p2"] },
      { id: "team3", name: "Team 3", playerIds: ["p3"] },
    ];

    const bracket = generateBracket("mens_singles", participants, { randomize: false });
    expect(bracket.roundNames).toEqual(["Semifinals", "Finals"]);

    // Match 1 should have a bye (slot 2 is null)
    const r1m1 = bracket.matches.find((m) => m.round === 1 && m.matchNumber === 1)!;
    expect(r1m1.status).toBe("bye");
    expect(r1m1.winnerId).toBe("team1");

    // Next match (Finals) should have team1 already advanced into slot 1!
    const r2m1 = bracket.matches.find((m) => m.round === 2 && m.matchNumber === 1)!;
    expect(r2m1.participant1Id).toBe("team1");
    expect(r2m1.participant2Id).toBeNull();
  });

  it("advances winners and updates downstream matches", () => {
    const participants: TournamentParticipant[] = [
      { id: "team1", name: "Team 1", playerIds: ["p1"] },
      { id: "team2", name: "Team 2", playerIds: ["p2"] },
      { id: "team3", name: "Team 3", playerIds: ["p3"] },
      { id: "team4", name: "Team 4", playerIds: ["p4"] },
    ];

    let bracket = generateBracket("mens_singles", participants, { randomize: false });
    const r1m1 = bracket.matches.find((m) => m.round === 1 && m.matchNumber === 1)!;

    bracket = setMatchWinner(bracket, r1m1.id, "team1", { score1: 11, score2: 5 });
    const updatedR1M1 = bracket.matches.find((m) => m.id === r1m1.id)!;
    expect(updatedR1M1.status).toBe("completed");
    expect(updatedR1M1.winnerId).toBe("team1");
    expect(updatedR1M1.score1).toBe(11);
    expect(updatedR1M1.score2).toBe(5);

    const r2m1 = bracket.matches.find((m) => m.round === 2 && m.matchNumber === 1)!;
    expect(r2m1.participant1Id).toBe("team1");
  });

  it("rejects a final winner while the other semifinal is unresolved", () => {
    const entrants = ["a", "b", "c"].map((id) => ({ id, name: id, playerIds: [id] }));
    const bracket = generateBracket("mens_singles", entrants, { randomize: false });
    const final = bracket.matches.find((match) => match.round === 2)!;

    expect(() => setMatchWinner(bracket, final.id, "a")).toThrow("Both participants must be known");
    expect(final.winnerId).toBeNull();
    expect(final.status).toBe("pending");

    const semifinal = bracket.matches.find((match) => match.round === 1 && match.status !== "bye")!;
    const ready = setMatchWinner(bracket, semifinal.id, "b");
    const completed = setMatchWinner(ready, final.id, "a");
    expect(completed.matches.find((match) => match.id === final.id)?.winnerId).toBe("a");
  });

  it("rejects a winner who is not in the match", () => {
    const entrants = ["a", "b", "c", "d"].map((id) => ({ id, name: id, playerIds: [id] }));
    const bracket = generateBracket("mens_singles", entrants, { randomize: false });
    expect(() => setMatchWinner(bracket, bracket.matches[0]!.id, "c")).toThrow("Winner must be a participant");
  });

  it("supports editing: swapping participants between matches", () => {
    const participants: TournamentParticipant[] = [
      { id: "team1", name: "Team 1", playerIds: ["p1"] },
      { id: "team2", name: "Team 2", playerIds: ["p2"] },
      { id: "team3", name: "Team 3", playerIds: ["p3"] },
      { id: "team4", name: "Team 4", playerIds: ["p4"] },
    ];

    let bracket = generateBracket("mens_singles", participants, { randomize: false });
    const r1m1 = bracket.matches.find((m) => m.round === 1 && m.matchNumber === 1)!;
    const r1m2 = bracket.matches.find((m) => m.round === 1 && m.matchNumber === 2)!;

    // Swap team1 (m1, slot 1) with team4 (m2, slot 2)
    bracket = swapParticipants(bracket, r1m1.id, 1, r1m2.id, 2);

    const updatedM1 = bracket.matches.find((m) => m.id === r1m1.id)!;
    const updatedM2 = bracket.matches.find((m) => m.id === r1m2.id)!;

    expect(updatedM1.participant1Id).toBe("team4");
    expect(updatedM2.participant2Id).toBe("team1");
  });

  it("supports updating a match participant directly", () => {
    const participants: TournamentParticipant[] = [
      { id: "team1", name: "Team 1", playerIds: ["p1"] },
      { id: "team2", name: "Team 2", playerIds: ["p2"] },
    ];

    let bracket = generateBracket("mens_singles", participants, { randomize: false });
    const m = bracket.matches[0]!;
    bracket = updateMatchParticipant(bracket, m.id, 2, "custom_entrant");

    const updated = bracket.matches.find((item) => item.id === m.id)!;
    expect(updated.participant2Id).toBe("custom_entrant");
  });

  it("can reshuffle matchups", () => {
    const participants: TournamentParticipant[] = [
      { id: "t1", name: "T1", playerIds: ["p1"] },
      { id: "t2", name: "T2", playerIds: ["p2"] },
      { id: "t3", name: "T3", playerIds: ["p3"] },
      { id: "t4", name: "T4", playerIds: ["p4"] },
    ];

    const bracket = generateBracket("mens_singles", participants);
    const reshuffled = reshuffleBracketMatchups(bracket);
    expect(reshuffled.matches.length).toBe(bracket.matches.length);
    expect(reshuffled.participants.length).toBe(4);
  });
});



describe("Tournament result corrections", () => {
  const entrants = Array.from({ length: 8 }, (_, index) => ({
    id: `p${index + 1}`, name: `Player ${index + 1}`, playerIds: [`p${index + 1}`],
  }));

  function completedBracket(size = 4) {
    let bracket = generateBracket("mens_singles", entrants.slice(0, size), { randomize: false });
    for (const match of bracket.matches) {
      const current = bracket.matches.find((item) => item.id === match.id)!;
      bracket = setMatchWinner(bracket, current.id, current.participant1Id, { score1: 11, score2: 5 });
    }
    return bracket;
  }

  it.each([1, 2])("invalidates the final when semifinal %i changes winner", (semifinalNumber) => {
    const original = completedBracket();
    const corrected = setMatchWinner(original, `mens_singles_r1_m${semifinalNumber}`,
      semifinalNumber === 1 ? "p2" : "p4", { score1: 5, score2: 11 });

    expect(corrected.matches[2]).toMatchObject({
      participant1Id: semifinalNumber === 1 ? "p2" : "p1",
      participant2Id: semifinalNumber === 2 ? "p4" : "p3",
      winnerId: null, score1: null, score2: null, status: "pending",
    });
    expect(original.matches[2]).toMatchObject({ winnerId: "p1", score1: 11, score2: 5, status: "completed" });
    expect(corrected.matches[semifinalNumber === 1 ? 1 : 0]).toEqual(original.matches[semifinalNumber === 1 ? 1 : 0]);
  });

  it("clears every dependent result after a quarterfinal correction", () => {
    const original = completedBracket(8);
    const corrected = setMatchWinner(original, "mens_singles_r1_m2", "p4", { score1: 5, score2: 11 });

    expect(corrected.matches.find((match) => match.id === "mens_singles_r2_m1")).toMatchObject({
      participant1Id: "p1", participant2Id: "p4", winnerId: null, score1: null, score2: null, status: "pending",
    });
    expect(corrected.matches.find((match) => match.id === "mens_singles_r3_m1")).toMatchObject({
      participant1Id: null, participant2Id: "p5", winnerId: null, score1: null, score2: null, status: "pending",
    });
    expect(corrected.matches.find((match) => match.id === "mens_singles_r2_m2"))
      .toEqual(original.matches.find((match) => match.id === "mens_singles_r2_m2"));
  });

  it("invalidates the final even when the reset semifinal's winner lost the final", () => {
    const corrected = setMatchWinner(completedBracket(), "mens_singles_r1_m2", null);
    expect(corrected.matches[1]).toMatchObject({ winnerId: null, score1: null, score2: null, status: "pending" });
    expect(corrected.matches[2]).toMatchObject({ participant1Id: "p1", participant2Id: null,
      winnerId: null, score1: null, score2: null, status: "pending" });
  });

  it("keeps downstream results when only the score changes and the winner is unchanged", () => {
    const original = completedBracket();
    const corrected = setMatchWinner(original, "mens_singles_r1_m1", "p1", { score1: 11, score2: 9 });
    expect(corrected.matches[0]).toMatchObject({ winnerId: "p1", score1: 11, score2: 9 });
    expect(corrected.matches[2]).toEqual(original.matches[2]);
  });

  it("invalidates dependent results after replacing a participant in a completed semifinal", () => {
    const corrected = updateMatchParticipant(completedBracket(), "mens_singles_r1_m2", 2, "replacement");
    expect(corrected.matches[1]).toMatchObject({ participant2Id: "replacement", winnerId: null, score1: null, score2: null });
    expect(corrected.matches[2]).toMatchObject({ participant1Id: "p1", participant2Id: null,
      winnerId: null, score1: null, score2: null, status: "pending" });
  });

  it("preserves an automatic bye while correcting the played semifinal", () => {
    let bracket = generateBracket("mens_singles", entrants.slice(0, 3), { randomize: false });
    bracket = setMatchWinner(bracket, "mens_singles_r1_m2", "p2", { score1: 11, score2: 5 });
    bracket = setMatchWinner(bracket, "mens_singles_r2_m1", "p1", { score1: 11, score2: 5 });
    const corrected = setMatchWinner(bracket, "mens_singles_r1_m2", "p3", { score1: 5, score2: 11 });
    expect(corrected.matches[0]).toEqual(bracket.matches[0]);
    expect(corrected.matches[2]).toMatchObject({ participant1Id: "p1", participant2Id: "p3",
      winnerId: null, score1: null, score2: null, status: "pending" });
  });
});
