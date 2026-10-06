import { beforeEach, describe, expect, it } from "vitest";

import { createGroupAction, organizerLoginAction } from "@/app/actions/auth";
import { startSessionAction } from "@/app/actions/sessions";
import { recordResultAction } from "@/app/actions/results";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { setActionRepository } from "@/app/actions/action-context";

describe("Server Actions Security and Validation", () => {
  let repository: InMemoryRepositories;

  beforeEach(() => {
    repository = new InMemoryRepositories({
      groups: [
        {
          id: "group-1",
          name: "Tuesday Group",
          organizerPinHash: "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890", // placeholder
          publicShareId: "share-token-123",
          createdAt: new Date(),
        },
      ],
      players: [
        { id: "p1", groupId: "group-1", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
        { id: "p2", groupId: "group-1", name: "Bob", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
        { id: "p3", groupId: "group-1", name: "Charlie", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
        { id: "p4", groupId: "group-1", name: "Diana", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true },
      ],
    });
    setActionRepository(repository);
  });

  it("requires SETUP_TOKEN for group setup and rejects invalid tokens", async () => {
    const invalidResult = await createGroupAction({
      name: "Pickleball Club",
      pin: "1234",
      setupToken: "wrong-token",
    });

    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.error).toBe("Invalid or missing setup token");
    }

    // Ensure raw db or secret is never exposed
    expect(JSON.stringify(invalidResult)).not.toContain("password");
    expect(JSON.stringify(invalidResult)).not.toContain("DATABASE_URL");
  });

  it("validates PIN and enforces generic failure message on login", async () => {
    const failedResult = await organizerLoginAction({
      groupId: "group-1",
      pin: "0000",
    });

    expect(failedResult.ok).toBe(false);
    if (!failedResult.ok) {
      expect(failedResult.error).toContain("Invalid PIN");
    }
  });

  it("rejects unauthorized organizer mutations without session cookie", async () => {
    const unauthSession = await startSessionAction({
      groupId: "group-1",
      courtCount: 1,
      playerIds: ["p1", "p2", "p3", "p4"],
      idempotencyKey: "idem-1",
    });

    expect(unauthSession.ok).toBe(false);
    if (!unauthSession.ok) {
      expect(unauthSession.error).toBe("Not authorized");
    }
  });

  it("validates input fields and returns typed errors on malformed payloads", async () => {
    const malformed = await startSessionAction({
      groupId: "group-1",
      courtCount: 10, // Max allowed is 6
      playerIds: ["p1", "p2"], // Min is 4
      idempotencyKey: "",
    });

    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.fieldErrors).toBeDefined();
    }
  });

  it("rejects tied scores in recordResultAction", async () => {
    const tiedResult = await recordResultAction({
      groupId: "group-1",
      matchId: "m1",
      team1Score: 11,
      team2Score: 11,
      matchVersion: 1,
      idempotencyKey: "idem-2",
    });

    expect(tiedResult.ok).toBe(false);
    if (!tiedResult.ok) {
      expect(tiedResult.error).toContain("tie");
    }
  });
});
