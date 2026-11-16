import { describe, expect, it } from "vitest";

import { deletePlayerSchema, playerLoginSchema } from "@/lib/validation/group";

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

describe("playerLoginSchema", () => {
  it("accepts valid username and password", () => {
    const result = playerLoginSchema.safeParse({
      username: "rally_champ",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid email and password via username, email, or identifier fields", () => {
    expect(
      playerLoginSchema.safeParse({
        username: "user@example.com",
        password: "password123",
      }).success
    ).toBe(true);

    expect(
      playerLoginSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      }).success
    ).toBe(true);

    expect(
      playerLoginSchema.safeParse({
        identifier: "user@example.com",
        password: "password123",
      }).success
    ).toBe(true);
  });

  it("rejects identifiers shorter than 3 characters", () => {
    expect(
      playerLoginSchema.safeParse({
        username: "ab",
        password: "password123",
      }).success
    ).toBe(false);

    expect(
      playerLoginSchema.safeParse({
        identifier: "  a  ",
        password: "password123",
      }).success
    ).toBe(false);
  });

  it("rejects missing passwords or extraneous fields", () => {
    expect(
      playerLoginSchema.safeParse({
        username: "rally_champ",
        password: "",
      }).success
    ).toBe(false);

    expect(
      playerLoginSchema.safeParse({
        username: "rally_champ",
        password: "password123",
        unknownProp: "bad",
      }).success
    ).toBe(false);
  });
});
