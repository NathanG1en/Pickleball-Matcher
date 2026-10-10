import { describe, expect, it } from "vitest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

const account = {
  id: "user-1",
  username: "player_one",
  name: "Player One",
  passwordHash: "hashed-password",
  skillLevel: "beginner" as const,
  initialRating: 900,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
};

describe("player account group membership and history", () => {
  it("lets accounts join public groups with their starting rating, and rejects private groups", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        { id: "public", name: "Public Group", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
        { id: "private", name: "Private Group", organizerPinHash: "hash", createdAt: new Date(), isPublic: false },
      ],
      playerAccounts: [account],
    });

    const joined = await repository.joinPublicGroup(account.id, "public");

    expect(joined).toMatchObject({ groupId: "public", accountId: account.id, name: account.name, initialRating: 900, rating: 900 });
    expect(await repository.joinPublicGroup(account.id, "private")).toBeNull();
    expect(await repository.listPublicGroups("group", account.id)).toMatchObject([{ id: "public", isMember: true }]);
  });

  it("updates a player name across memberships and retains per-session results", async () => {
    const repository = new InMemoryRepositories({
      groups: [{ id: "public", name: "Public Group", organizerPinHash: "hash", createdAt: new Date(), isPublic: true }],
      playerAccounts: [account],
    });
    const player = await repository.joinPublicGroup(account.id, "public");
    if (!player) throw new Error("Expected public group membership");

    repository.state.sessions.push({ id: "session-1", groupId: "public", courtCount: 1, status: "completed", currentRoundNumber: 1, startedAt: new Date("2026-10-02T12:00:00.000Z"), endedAt: new Date("2026-10-02T13:00:00.000Z"), version: 1 });
    repository.state.attendance.push({ sessionId: "session-1", playerId: player.id, joinedRound: 1, leftRound: null });
    repository.state.rounds.push({ id: "round-1", sessionId: "session-1", roundNumber: 1, status: "completed", seed: 1, scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 }, createdAt: new Date(), startedAt: new Date(), completedAt: new Date(), version: 1 });
    repository.state.matches.push({ id: "match-1", roundId: "round-1", courtNumber: 1, status: "completed", team1Score: 11, team2Score: 6, completedAt: new Date(), version: 1 });
    repository.state.matchPlayers.push({ matchId: "match-1", playerId: player.id, team: 1, ratingBefore: 900, ratingAfter: 910 });

    await repository.updatePlayerAccountName(account.id, "New Display Name");
    const history = await repository.listPlayerSessionHistory(account.id);

    expect((await repository.getPlayerAccount(account.id))?.name).toBe("New Display Name");
    expect((await repository.listPlayers("public"))[0].name).toBe("New Display Name");
    expect(history).toMatchObject([{ sessionId: "session-1", groupName: "Public Group", wins: 1, losses: 0, rating: 910 }]);
  });

  it("prevents hosts from leaving their own group while allowing other members to leave", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        { id: "hosted", name: "Hosted Group", organizerPinHash: "hash", createdAt: new Date(), isPublic: true, ownerAccountId: account.id },
        { id: "other", name: "Other Group", organizerPinHash: "hash", createdAt: new Date(), isPublic: true, ownerAccountId: "other-owner" },
      ],
      playerAccounts: [account],
    });
    await repository.joinPublicGroup(account.id, "hosted");
    await repository.joinPublicGroup(account.id, "other");

    const leftHosted = await repository.leavePublicGroup(account.id, "hosted");
    expect(leftHosted).toBe(false);

    const leftOther = await repository.leavePublicGroup(account.id, "other");
    expect(leftOther).toBe(true);
  });

  it("updates a player username and enforces uniqueness in repository", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        account,
        {
          id: "user-2",
          username: "player_two",
          name: "Player Two",
          passwordHash: "hashed",
          skillLevel: "beginner",
          initialRating: 900,
          createdAt: new Date(),
        },
      ],
    });

    await repository.updatePlayerAccountUsername(account.id, "player_one_updated");
    expect((await repository.getPlayerAccount(account.id))?.username).toBe("player_one_updated");

    await expect(repository.updatePlayerAccountUsername(account.id, "player_two")).rejects.toThrow();
  });
});
