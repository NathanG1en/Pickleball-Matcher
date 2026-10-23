import { describe, it, expect } from "vitest";
import {
  calculateSynergyScore,
  calculateMatchContribution,
  updateSynergyState,
  getExpectedNormalizedMargin,
} from "@/lib/synergy/calculator";

describe("calculateSynergyScore and updateSynergyState", () => {
  it("defaults to 0 for 0 matches played", () => {
    expect(calculateSynergyScore(0, 0)).toBe(0);
  });

  it("dampens single-match extremes using prior of 12", () => {
    // 1 match, 1 win at 50% expected: contribution ~ 0.5, neff = 1, neff/(neff+12) = 1/13 -> ~ 4
    const winScore = calculateSynergyScore(1, 1);
    expect(winScore).toBe(4);

    // 1 match, 0 wins at 50% expected: contribution ~ -0.5 -> ~ -4
    const lossScore = calculateSynergyScore(1, 0);
    expect(lossScore).toBe(-4);
  });

  it("rewards underdogs outperforming expectations over dominant favorites meeting expectations", () => {
    // Underdogs: expected 20% win chance, actually won 40% (8 wins, 12 losses)
    let underdogState = updateSynergyState(null, { won: true, expectedWinProbability: 0.2, ownScore: 11, opponentScore: 9 });
    for (let i = 1; i < 20; i++) {
      const won = i % 5 < 2; // 2 wins out of every 5 = 40%
      underdogState = updateSynergyState(underdogState, {
        won,
        expectedWinProbability: 0.2,
        ownScore: won ? 11 : 9,
        opponentScore: won ? 9 : 11,
      });
    }

    // Favorites: expected 85% win chance, actually won 85% (17 wins, 3 losses)
    let favState = updateSynergyState(null, { won: true, expectedWinProbability: 0.85, ownScore: 11, opponentScore: 4 });
    for (let i = 1; i < 20; i++) {
      const won = i % 7 !== 0; // ~85%
      favState = updateSynergyState(favState, {
        won,
        expectedWinProbability: 0.85,
        ownScore: won ? 11 : 4,
        opponentScore: won ? 4 : 11,
      });
    }

    // Underdog synergy score should be positive and distinctly higher than favorite
    expect(underdogState.synergyScore).toBeGreaterThan(favState.synergyScore);
    expect(underdogState.synergyScore).toBeGreaterThan(0);
  });

  it("distinguishes competitive close losses from severe blowouts via 10% margin blend", () => {
    // Both pairs lose at 50% expected
    const closeLoss = calculateMatchContribution({
      won: false,
      expectedWinProbability: 0.5,
      ownScore: 9,
      opponentScore: 11,
    });
    const blowoutLoss = calculateMatchContribution({
      won: false,
      expectedWinProbability: 0.5,
      ownScore: 0,
      opponentScore: 11,
    });

    // Close loss contribution is higher (less negative) than blowout loss
    expect(closeLoss).toBeGreaterThan(blowoutLoss);
  });

  it("interpolates normalized margin with symmetry around 0.5", () => {
    expect(getExpectedNormalizedMargin(0.5)).toBeCloseTo(0, 3);
    const m20 = getExpectedNormalizedMargin(0.2);
    const m80 = getExpectedNormalizedMargin(0.8);
    expect(m20).toBeCloseTo(-m80, 3);
  });

  it("clamps between -100 and 100", () => {
    expect(calculateSynergyScore(-1, 0)).toBe(0);
    const state = updateSynergyState(null, { won: true, expectedWinProbability: 0.01 });
    expect(state.synergyScore).toBeGreaterThanOrEqual(-100);
    expect(state.synergyScore).toBeLessThanOrEqual(100);
  });
});
