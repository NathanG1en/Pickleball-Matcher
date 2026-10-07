import { describe, expect, it } from "vitest";

import { deletePlayerSchema } from "@/lib/validation/group";

describe("deletePlayerSchema", () => {
  it("accepts valid groupId and playerId", () => {
    const valid = {
      groupId: "group-1",
      playerId: "player-123",
    };
    expect(deletePlayerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty playerId or groupId", () => {
    expect(deletePlayerSchema.safeParse({ groupId: "", playerId: "p1" }).success).toBe(false);
    expect(deletePlayerSchema.safeParse({ groupId: "g1", playerId: "" }).success).toBe(false);
  });

  it("rejects extraneous fields", () => {
    expect(
      deletePlayerSchema.safeParse({
        groupId: "g1",
        playerId: "p1",
        extra: "not-allowed",
      }).success,
    ).toBe(false);
  });
});
