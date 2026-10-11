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

