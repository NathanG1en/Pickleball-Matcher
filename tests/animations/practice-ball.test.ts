import { describe, expect, it } from "vitest";
import { applyPracticeBallLaunch, pickPracticeBallLaunch } from "@/lib/animations/practice-ball";

describe("practice profile pickleball launch", () => {
  it("varies the start within a small range and spins with the sideways travel", () => {
    const low = pickPracticeBallLaunch(() => 0);
    const high = pickPracticeBallLaunch(() => 0.999);
    expect(low).toEqual({ fromX: -48, dropHeight: 120, spin: -240 });
    expect(high.fromX).toBe(64);
    expect(high.dropHeight).toBe(180);
    expect(high.spin).toBe(320);
    // Coming from the left rolls the other way to coming from the right.
    expect(Math.sign(low.spin)).toBe(Math.sign(low.fromX));
  });

  it("gives different launches across opens", () => {
    const launches = new Set(Array.from({ length: 20 }, () => JSON.stringify(pickPracticeBallLaunch())));
    expect(launches.size).toBeGreaterThan(1);
  });

  it("writes the launch as CSS variables for the keyframes", () => {
    const values = new Map<string, string>();
    const element = { style: { setProperty: (key: string, value: string) => values.set(key, value) } } as unknown as HTMLElement;
    applyPracticeBallLaunch(element, { fromX: -20, dropHeight: 150, spin: -100 });
    expect(Object.fromEntries(values)).toEqual({
      "--practice-ball-from-x": "-20px",
      "--practice-ball-drop": "150px",
      "--practice-ball-spin": "-100deg",
    });
  });
});
