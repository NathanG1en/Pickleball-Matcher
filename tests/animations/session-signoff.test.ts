import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeSessionEnded, markSessionEnded } from "@/lib/animations/session-signoff";

let entries: Map<string, string>;
beforeEach(() => {
  entries = new Map();
  vi.stubGlobal("window", { sessionStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  } });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T15:00:00Z"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("session completion handoff", () => {
  it("plays only once for the confirmed session and group", () => {
    markSessionEnded("group-a", "session-a");
    expect(consumeSessionEnded("group-b", "session-a")).toBe(false);
    expect(consumeSessionEnded("group-a", "session-a")).toBe(true);
    expect(consumeSessionEnded("group-a", "session-a")).toBe(false);
    markSessionEnded("group-a", "session-a");
    expect(consumeSessionEnded("group-a", "old-session")).toBe(false);
    expect(consumeSessionEnded("group-a", "session-a")).toBe(false);
  });
  it("discards expired and malformed handoffs instead of replaying historical completion", () => {
    markSessionEnded("group", "session");
    vi.advanceTimersByTime(30001);
    expect(consumeSessionEnded("group", "session")).toBe(false);
    entries.set("pickleball:session-ended:group", "broken json");
    expect(consumeSessionEnded("group", "session")).toBe(false);
    expect(entries.size).toBe(0);
  });
  it("does not interfere with ending or viewing sessions if storage is blocked", () => {
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("Storage blocked"); } });
    expect(() => markSessionEnded("group", "session")).not.toThrow();
    expect(consumeSessionEnded("group", "session")).toBe(false);
  });
});
