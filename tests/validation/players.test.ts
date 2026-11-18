import { describe, expect, it } from "vitest";

import {
  deletePlayerSchema,
  playerLoginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/lib/validation/group";

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
        password: "password123",
        unknownProp: "bad",
      }).success
    ).toBe(false);
  });
});

describe("requestPasswordResetSchema", () => {
  it("accepts valid identifier (username or email) and trims it", () => {
    const result = requestPasswordResetSchema.safeParse({
      identifier: "  Player@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identifier).toBe("Player@Example.COM");
    }
  });

  it("rejects empty identifier", () => {
    expect(requestPasswordResetSchema.safeParse({ identifier: "" }).success).toBe(false);
    expect(requestPasswordResetSchema.safeParse({ identifier: "   " }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid token and new password (min 10 chars)", () => {
    const result = resetPasswordSchema.safeParse({
      token: "valid-recovery-token",
      password: "strongpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short passwords and empty tokens", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "token",
        password: "short",
      }).success
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        token: "",
        password: "strongpassword123",
      }).success
    ).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  it("accepts valid verification token", () => {
    const result = verifyEmailSchema.safeParse({ token: "valid-token-123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty verification token", () => {
    const result = verifyEmailSchema.safeParse({ token: "" });
    expect(result.success).toBe(false);
  });
});


