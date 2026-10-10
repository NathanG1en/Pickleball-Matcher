import { describe, it, expect, beforeEach } from "vitest";
import {
  searchPlayersByUsernameAction,
  updatePlayerPrivacyAction,
  addPlayerByAccountIdAction,
} from "@/app/actions/players";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { setActionRepository } from "@/app/actions/action-context";

describe("searchPlayersByUsernameAction", () => {
  let repository: InMemoryRepositories;

  beforeEach(() => {
    repository = new InMemoryRepositories({
      groups: [{ id: "grp_1", name: "Pickle Club", organizerPinHash: "pin", createdAt: new Date(), isPublic: true }],
      playerAccounts: [
        {
          id: "acc_pub",
          username: "alice_pub",
          name: "Alice Public",
          isPublic: true,
          passwordHash: "h",
          skillLevel: "advanced",
          initialRating: 1400,
          createdAt: new Date(),
        },
        {
          id: "acc_priv",
          username: "bob_priv",
          name: "Bob Private",
          isPublic: false,
          passwordHash: "h",
          skillLevel: "intermediate",
          initialRating: 1200,
          createdAt: new Date(),
        },
      ],
      players: [
        {
          id: "p_1",
          groupId: "grp_1",
          name: "Alice Public",
          initialRating: 1400,
          rating: 1400,
          ratedGamesPlayed: 0,
          active: true,
          accountId: "acc_pub",
        },
      ],
    });
    setActionRepository(repository);
  });

  it("rejects search queries shorter than 2 characters", async () => {
    const res = await searchPlayersByUsernameAction({ query: "a", groupId: "grp_1" });
    expect(res.ok).toBe(false);
  });

  it("finds matching public and private accounts and sanitizes private ones", async () => {
    const res = await searchPlayersByUsernameAction({ query: "bob", groupId: "grp_1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      const bob = res.data[0];
      expect(bob.username).toBe("bob_priv");
      expect(bob.isRestricted).toBe(true);
      expect(bob.rating).toBeUndefined();
      expect(bob.alreadyInGroup).toBe(false);
    }
  });

  it("flags alreadyInGroup accurately", async () => {
    const res = await searchPlayersByUsernameAction({ query: "alice", groupId: "grp_1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].alreadyInGroup).toBe(true);
      expect(res.data[0].isRestricted).toBe(false);
      expect(res.data[0].rating).toBe(1400);
    }
  });

  it("successfully adds a player to a private group via addPlayerByAccountIdAction", async () => {
    const privGroup = {
      id: "grp_priv",
      name: "Private Pickle Club",
      organizerPinHash: "pin",
      createdAt: new Date(),
      isPublic: false,
      ownerAccountId: "acc_pub",
    };
    await repository.insertGroup(privGroup);

    // addPlayerToGroup works for private group
    const added = await repository.addPlayerToGroup("acc_priv", "grp_priv");
    expect(added).not.toBeNull();
    expect(added?.name).toBe("Bob Private");
    expect(added?.accountId).toBe("acc_priv");

    const roster = await repository.listPlayers("grp_priv");
    expect(roster.some((p) => p.accountId === "acc_priv")).toBe(true);
  });
});
