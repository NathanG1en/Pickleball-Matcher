import { describe, expect, it, vi } from "vitest";
import { updatePlayerAction } from "@/app/actions/players";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/actions/action-context", async importOriginal => ({
  ...await importOriginal<typeof import("@/app/actions/action-context")>(),
  requireOrganizer: vi.fn(async () => null),
}));

describe("organizer rating correction boundary", () => {
  it("rejects starting-rating changes even for an authorized organizer and performs no writes", async () => {
    const repository = new InMemoryRepositories({ players: [{ id: "p", groupId: "g", name: "Guest", initialRating: 1000, rating: 1050, active: true, ratedGamesPlayed: 3 }] });
    setActionRepository(repository);
    const result = await updatePlayerAction({ groupId: "g", playerId: "p", initialRating: 4, name: "Changed", idempotencyKey: "test-correction" });
    expect(result.ok).toBe(false);
    expect(repository.writeCount).toBe(0);
    expect(repository.state.players[0]).toMatchObject({ name: "Guest", initialRating: 1000, rating: 1050 });
  });
});
