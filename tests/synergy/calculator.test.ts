import { describe, it, expect } from "vitest";
import { calculateSynergyScore } from "@/lib/synergy/calculator";

describe("calculateSynergyScore", () => {
  it("defaults to 50% for 0 matches played", () => {
    expect(calculateSynergyScore(0, 0)).toBe(50);
  });

  it("applies Bayesian Laplace smoothing for low sample sizes", () => {
    // 1 match, 1 win: (1 + 1) / (1 + 2) = 2/3 = 67%
    expect(calculateSynergyScore(1, 1)).toBe(67);
    // 1 match, 0 wins: (0 + 1) / (1 + 2) = 1/3 = 33%
    expect(calculateSynergyScore(1, 0)).toBe(33);
  });

  it("converges toward actual win rate as sample size increases", () => {
    // 10 matches, 10 wins: (10 + 1) / (10 + 2) = 11/12 = 92%
    expect(calculateSynergyScore(10, 10)).toBe(92);
    // 100 matches, 80 wins: (80 + 1) / (100 + 2) = 81/102 = 79%
    expect(calculateSynergyScore(100, 80)).toBe(79);
  });

  it("clamps between 0 and 100", () => {
    expect(calculateSynergyScore(-1, 0)).toBe(50);
    expect(calculateSynergyScore(5, 5)).toBeGreaterThanOrEqual(0);
    expect(calculateSynergyScore(5, 5)).toBeLessThanOrEqual(100);
  });
});
