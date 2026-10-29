import { describe, expect, it } from "vitest";
import {
  deleteSessionSchema,
  manualCourtSchema,
  startRoundSchema,
  submitSessionPickupGameSchema,
  updateCourtConfigSchema,
} from "@/lib/validation/session";

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

  it("accepts a scored team-vs-one court (2 vs 1)", () => {
    const res = manualCourtSchema.safeParse({
      courtNumber: 1,
      team1: ["p1", "p2"],
      team2: ["p3"],
    });
    expect(res.success).toBe(true);
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

describe("deleteSessionSchema", () => {
  it("accepts valid groupId and sessionId", () => {
    const res = deleteSessionSchema.safeParse({
      groupId: "grp_123",
      sessionId: "ses_456",
    });
    expect(res.success).toBe(true);
  });

  it("rejects empty or invalid IDs", () => {
    const res = deleteSessionSchema.safeParse({
      groupId: "",
      sessionId: "ses_456",
    });
    expect(res.success).toBe(false);
  });

  it("rejects unknown extra fields due to strict schema", () => {
    const res = deleteSessionSchema.safeParse({
      groupId: "grp_123",
      sessionId: "ses_456",
      extra: true,
    });
    expect(res.success).toBe(false);
  });
});

describe("updateCourtConfigSchema", () => {
  const baseInput = {
    groupId: "grp_123",
    sessionId: "ses_456",
    sessionVersion: 1,
    courtCount: 2,
    courtPlayerCounts: [4, 4],
    idempotencyKey: "key_789",
  };

  it("accepts valid court configuration", () => {
    const res = updateCourtConfigSchema.safeParse(baseInput);
    expect(res.success).toBe(true);
  });

  it("accepts valid court configuration without courtPlayerCounts", () => {
    const res = updateCourtConfigSchema.safeParse({
      ...baseInput,
      courtPlayerCounts: undefined,
    });
    expect(res.success).toBe(true);
  });

  it("rejects mismatched courtPlayerCounts length and courtCount", () => {
    const res = updateCourtConfigSchema.safeParse({
      ...baseInput,
      courtCount: 2,
      courtPlayerCounts: [4, 4, 2],
    });
    expect(res.success).toBe(false);
  });

  it("rejects invalid court count outside 1 to 6", () => {
    expect(
      updateCourtConfigSchema.safeParse({ ...baseInput, courtCount: 0, courtPlayerCounts: [] }).success,
    ).toBe(false);
    expect(
      updateCourtConfigSchema.safeParse({
        ...baseInput,
        courtCount: 7,
        courtPlayerCounts: [4, 4, 4, 4, 4, 4, 4],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid player counts per court (not 2, 3, or 4)", () => {
    const res = updateCourtConfigSchema.safeParse({
      ...baseInput,
      courtCount: 2,
      courtPlayerCounts: [5, 4],
    });
    expect(res.success).toBe(false);
  });
});

describe("submitSessionPickupGameSchema", () => {
  const basePickupInput = {
    groupId: "grp-1",
    sessionId: "ses-1",
    team1PlayerIds: ["p1", "p2"],
    team2PlayerIds: ["p3", "p4"],
    team1Score: 11,
    team2Score: 7,
    rated: true,
  };

  it("accepts valid doubles pickup game", () => {
    const res = submitSessionPickupGameSchema.safeParse(basePickupInput);
    expect(res.success).toBe(true);
  });

  it("accepts valid singles pickup game", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1PlayerIds: ["p1"],
      team2PlayerIds: ["p3"],
      team1Score: 15,
      team2Score: 13,
      rated: false,
    });
    expect(res.success).toBe(true);
  });

  it("rejects ties", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1Score: 11,
      team2Score: 11,
    });
    expect(res.success).toBe(false);
  });

  it("rejects duplicate players across teams", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1PlayerIds: ["p1", "p2"],
      team2PlayerIds: ["p1", "p4"],
    });
    expect(res.success).toBe(false);
  });

  it("rejects duplicate players within the same team", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1PlayerIds: ["p1", "p1"],
      team2PlayerIds: ["p3", "p4"],
    });
    expect(res.success).toBe(false);
  });

  it("rejects teams with more than 2 players", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1PlayerIds: ["p1", "p2", "p5"],
      team2PlayerIds: ["p3", "p4"],
    });
    expect(res.success).toBe(false);
  });

  it("rejects empty teams", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1PlayerIds: [],
      team2PlayerIds: ["p3", "p4"],
    });
    expect(res.success).toBe(false);
  });

  it("rejects negative scores", () => {
    const res = submitSessionPickupGameSchema.safeParse({
      ...basePickupInput,
      team1Score: -1,
      team2Score: 11,
    });
    expect(res.success).toBe(false);
  });
});

