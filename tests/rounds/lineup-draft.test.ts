import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLineupDraft, readLineupDraft, saveLineupDraft } from "@/lib/rounds/lineup-draft";

const proposal = { courts: [{ courtNumber: 1, team1: ["a", "b"], team2: ["c", "d"] }], sitting: ["e"] };
const edited = { courts: [{ courtNumber: 1, team1: ["e", "b"], team2: ["c", "d"] }], sitting: ["a"] };
let entries: Map<string, string>;
beforeEach(() => {
  entries = new Map();
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe("lineup drafts", () => {
  it("restores swaps including sitting players only for the same session context", () => {
    saveLineupDraft("session-a", "1:1", edited);
    expect(readLineupDraft("session-a", "1:1", proposal)).toEqual(edited);
    expect(readLineupDraft("session-b", "1:1", proposal)).toBeNull();
    expect(readLineupDraft("session-a", "2:1", proposal)).toBeNull();
    expect(readLineupDraft("session-a", "1:2", proposal)).toBeNull();
    clearLineupDraft("session-a");
    expect(readLineupDraft("session-a", "1:1", proposal)).toBeNull();
  });
  it("rejects stale attendance, changed courts, duplicate players and malformed storage", () => {
    saveLineupDraft("draft", "1", edited);
    expect(readLineupDraft("draft", "1", { ...proposal, sitting: [] })).toBeNull();
    expect(readLineupDraft("draft", "1", { ...proposal, courts: [{ ...proposal.courts[0], courtNumber: 2 }] })).toBeNull();
    saveLineupDraft("draft", "1", { ...edited, sitting: ["e"] });
    expect(readLineupDraft("draft", "1", proposal)).toBeNull();
    entries.set("draft", "broken json");
    expect(readLineupDraft("draft", "1", proposal)).toBeNull();
  });
  it("allows editing when browser storage is unavailable", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Blocked"); } });
    expect(() => saveLineupDraft("draft", "1", edited)).not.toThrow();
    expect(readLineupDraft("draft", "1", proposal)).toBeNull();
    expect(() => clearLineupDraft("draft")).not.toThrow();
  });
});
