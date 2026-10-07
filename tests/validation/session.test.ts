import { describe, expect, it } from "vitest";

import { manualCourtSchema, startRoundSchema } from "@/lib/validation/session";

describe("manualCourtSchema", () => {
  it("accepts balanced doubles court (2 vs 2)", () => {
    const res = manualCourtSchema.safeParse({
      courtNumber: 1,
      team1: ["p1", "p2"],
      team2: ["p3", "p4"],
    });
    expect(res.success).toBe(true);
  });

  it("accepts balanced singles court (1 vs 1)", () => {
    const res = manualCourtSchema.safeParse({
      courtNumber: 2,
      team1: ["p1"],
      team2: ["p2"],
    });
    expect(res.success).toBe(true);
  });

  it("rejects unbalanced court (2 vs 1)", () => {
    const res = manualCourtSchema.safeParse({
      courtNumber: 1,
      team1: ["p1", "p2"],
      team2: ["p3"],
    });
    expect(res.success).toBe(false);
  });
});

describe("startRoundSchema", () => {
  const baseInput = {
    groupId: "grp-1",
    sessionId: "sess-1",
    sessionVersion: 1,
    seed: 42,
    idempotencyKey: "key-1",
  };

  it("accepts valid seed-only round start request", () => {
    const res = startRoundSchema.safeParse(baseInput);
    expect(res.success).toBe(true);
  });

  it("accepts valid manual court and sitting proposal", () => {
    const res = startRoundSchema.safeParse({
      ...baseInput,
      manualCourts: [
        {
          courtNumber: 1,
          team1: ["p1", "p2"],
          team2: ["p3", "p4"],
        },
        {
          courtNumber: 2,
          team1: ["p5"],
          team2: ["p6"],
        },
      ],
      manualSitting: ["p7", "p8"],
    });
    expect(res.success).toBe(true);
  });

  it("rejects duplicate player appearing on court and sitting", () => {
    const res = startRoundSchema.safeParse({
      ...baseInput,
      manualCourts: [
        {
          courtNumber: 1,
          team1: ["p1", "p2"],
          team2: ["p3", "p4"],
        },
      ],
      manualSitting: ["p1"], // p1 is already on court 1
    });
    expect(res.success).toBe(false);
  });

  it("rejects duplicate player appearing on two courts", () => {
    const res = startRoundSchema.safeParse({
      ...baseInput,
      manualCourts: [
        {
          courtNumber: 1,
          team1: ["p1", "p2"],
          team2: ["p3", "p4"],
        },
        {
          courtNumber: 2,
          team1: ["p1"], // p1 duplicated
          team2: ["p5"],
        },
      ],
      manualSitting: [],
    });
    expect(res.success).toBe(false);
  });
});
