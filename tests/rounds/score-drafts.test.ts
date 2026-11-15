import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readScoreDrafts, scoreDraftsKey, writeScoreDrafts } from "@/lib/rounds/score-drafts";

describe("score drafts in session storage", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "window", {
      value: {
        sessionStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
          removeItem: (k: string) => void store.delete(k),
        },
      },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("restores typed scores only for matches still waiting for a result", () => {
    const key = scoreDraftsKey("round-1");
    writeScoreDrafts(key, { m1: { team1: "11", team2: "8" }, m2: { team1: "4", team2: "" } });
    expect(readScoreDrafts(key, new Set(["m2"]))).toEqual({ m2: { team1: "4", team2: "" } });
    expect(readScoreDrafts(key, new Set())).toBeNull();
  });

  it("clears storage when there are no drafts and ignores corrupt data", () => {
    const key = scoreDraftsKey("round-1");
    writeScoreDrafts(key, { m1: { team1: "11", team2: "8" } });
    writeScoreDrafts(key, {});
    expect(store.has(key)).toBe(false);
    store.set(key, "{oops");
    expect(readScoreDrafts(key, new Set(["m1"]))).toBeNull();
  });
});
