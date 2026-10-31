import { afterEach, describe, expect, it, vi } from "vitest";
import { recordMultipleResultsAction } from "@/app/actions/results";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { addOtherSessionMatch, seedBatchScores } from "../fixtures/batch-scores";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/actions/action-context", async importOriginal => ({ ...await importOriginal<typeof import("@/app/actions/action-context")>(), requireOrganizer: async (groupId: string) => { if (groupId !== "batch-group") throw new Error("Not authorized"); } }));
afterEach(() => setActionRepository(null));

describe("batch score action boundary", () => {
  it.each([false, true])("rejects a match from another session (foreign group: %s) without partial writes", async foreignGroup => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    await addOtherSessionMatch(repository, foreignGroup);
    setActionRepository(repository);
    const before = structuredClone(repository.state);
    const result = await recordMultipleResultsAction({ groupId: "batch-group", sessionId: "batch-session", results: [inputs[0], { matchId: "other-match", team1Score: 11, team2Score: 9, matchVersion: 1 }] });
    expect(result.ok).toBe(false);
    expect(repository.state).toEqual(before);
  });

  it("rejects an entirely foreign batch even when the caller supplies no session ID", async () => {
    const repository = new InMemoryRepositories();
    await seedBatchScores(repository);
    await addOtherSessionMatch(repository, true);
    setActionRepository(repository);
    const before = structuredClone(repository.state);
    expect((await recordMultipleResultsAction({ groupId: "batch-group", results: [{ matchId: "other-match", team1Score: 11, team2Score: 9, matchVersion: 1 }] })).ok).toBe(false);
    expect(repository.state).toEqual(before);
  });

  it("honors client match versions rather than replacing a newer result", async () => {
    const repository = new InMemoryRepositories();
    const { inputs } = await seedBatchScores(repository);
    repository.state.matches[1].version = 2;
    setActionRepository(repository);
    const before = structuredClone(repository.state);
    expect((await recordMultipleResultsAction({ groupId: "batch-group", sessionId: "batch-session", results: inputs })).ok).toBe(false);
    expect(repository.state).toEqual(before);
  });
});
