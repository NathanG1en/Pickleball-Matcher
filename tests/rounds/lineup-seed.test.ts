import { describe, expect, it } from "vitest";
import { defaultLineupSeed, parseLineupChoice } from "@/lib/rounds/lineup-seed";
import { proposeRoundFromSnapshot } from "@/lib/matchmaking/proposal";
import type { AttendanceRecord, PlayerRecord, SessionRecord } from "@/lib/domain/types";

describe("defaultLineupSeed", () => {
  it("is the same for the same session and round, and differs across rounds and sessions", () => {
    expect(defaultLineupSeed("ses-1", 3)).toBe(defaultLineupSeed("ses-1", 3));
    expect(defaultLineupSeed("ses-1", 3)).not.toBe(defaultLineupSeed("ses-1", 4));
    expect(defaultLineupSeed("ses-1", 3)).not.toBe(defaultLineupSeed("ses-2", 3));
    const seed = defaultLineupSeed("session_abc", 12);
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffff_ffff).toBe(true);
  });

  it("makes the proposed lineup identical on every load", () => {
    const session: SessionRecord = {
      id: "ses-1", groupId: "grp-1", courtCount: 2, status: "active", currentRoundNumber: 0,
      startedAt: new Date(), endedAt: null, version: 1,
    };
    const players: PlayerRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`, groupId: "grp-1", name: `Player ${i}`, initialRating: 1000 + i * 10, rating: 1000 + i * 10,
      ratedGamesPlayed: 0, active: true,
    }));
    const attendance: AttendanceRecord[] = players.map((p) => ({ sessionId: "ses-1", playerId: p.id, joinedRound: 1, leftRound: null }) as AttendanceRecord);
    const snapshot = { session, players, attendance, rounds: [] };
    const seed = defaultLineupSeed(session.id, 1);
    expect(proposeRoundFromSnapshot(snapshot, seed)).toEqual(proposeRoundFromSnapshot(snapshot, seed));
  });
});

describe("parseLineupChoice", () => {
  const raw = JSON.stringify({ roundNumber: 2, sessionVersion: 5, seed: 42, temperature: 1 });

  it("returns the choice only for the round and session state it was made for", () => {
    expect(parseLineupChoice(raw, 2, 5)).toEqual({ roundNumber: 2, sessionVersion: 5, seed: 42, temperature: 1 });
    expect(parseLineupChoice(raw, 3, 5)).toBeNull();
    expect(parseLineupChoice(raw, 2, 6)).toBeNull();
  });

  it("ignores empty or corrupt storage", () => {
    expect(parseLineupChoice("", 2, 5)).toBeNull();
    expect(parseLineupChoice("{nope", 2, 5)).toBeNull();
    expect(parseLineupChoice(JSON.stringify({ seed: "x" }), 2, 5)).toBeNull();
  });
});
