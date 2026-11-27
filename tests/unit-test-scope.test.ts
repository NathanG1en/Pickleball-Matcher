import { describe, expect, it } from "vitest";
import scope from "../scripts/testing/unit-test-scope.json" with { type: "json" };

describe("shared fast test scope", () => {
  it("keeps database, browser, simulation and rate-limit suites out of both runners", () => {
    expect(scope.include).toEqual(["tests/**/*.test.{ts,tsx}"]);
    expect(scope.exclude).toEqual([
      "tests/e2e/**",
      "tests/integration/**",
      "tests/maintenance-postgres/**",
      "tests/simulations/**",
      "tests/auth/rate-limit.test.ts",
    ]);
  });
});
