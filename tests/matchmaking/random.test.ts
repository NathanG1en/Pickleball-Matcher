import { describe, expect, it } from "vitest";

import { createSeededRandom } from "@/lib/matchmaking/random";

describe("createSeededRandom", () => {
  it("keeps the documented xorshift32 sequence stable", () => {
    const random = createSeededRandom(1);

    expect([random.next(), random.next(), random.next(), random.next()]).toEqual([
      0.00006295018829405308,
      0.015747428173199296,
      0.6164041024167091,
      0.07161863497458398,
    ]);
  });

  it("repeats the same sequence for the same seed", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("changes the sequence when the seed changes", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(43);

    expect([first.next(), first.next(), first.next()]).not.toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("returns values in the half-open unit interval", () => {
    const random = createSeededRandom(2026);

    for (let index = 0; index < 1_000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces bounded integers", () => {
    const random = createSeededRandom(12);

    for (let index = 0; index < 100; index += 1) {
      expect([0, 1, 2, 3, 4, 5, 6]).toContain(random.integer(7));
    }
  });

  it("shuffles deterministically without mutating its input", () => {
    const values = Object.freeze(["a", "b", "c", "d", "e"]);

    const first = createSeededRandom(99).shuffle(values);
    const second = createSeededRandom(99).shuffle(values);

    expect(first).toEqual(second);
    expect(first).not.toEqual(values);
    expect(values).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("rejects a non-positive integer bound", () => {
    const random = createSeededRandom(12);

    expect(() => random.integer(0)).toThrow("maxExclusive must be positive");
  });
});
