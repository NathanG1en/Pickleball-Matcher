import { beforeEach, expect, it, vi } from "vitest";
import { updateStayTogetherPairsAction, startRoundAction, changeAttendanceAction, updateCourtConfigAction, reshuffleRoundAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
let allowed = true;
vi.mock("@/app/actions/action-context", async original => ({ ...await original<typeof import("@/app/actions/action-context")>(), requireOrganizer: async () => { if (!allowed) throw new Error("Organizer required"); return null; } }));
let repository: InMemoryRepositories;
const input = { groupId: "g1", sessionId: "s1", sessionVersion: 1, pairs: [["p1", "p2"]] };
beforeEach(() => {
  allowed = true;
  repository = new InMemoryRepositories({ sessions: [{ id: "s1", groupId: "g1", courtCount: 1, status: "active", currentRoundNumber: 0, version: 1, startedAt: new Date(), endedAt: null }],
    players: ["p1", "p2", "p3", "p4"].map(id => ({ id, name: id, groupId: "g1", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true })),
    attendance: ["p1", "p2", "p3", "p4"].map(playerId => ({ playerId, sessionId: "s1", joinedRound: 1, leftRound: null })) });
  setActionRepository(repository);
});
it("allows organizer pair edits and rejects stale editors", async () => {
  expect(await updateStayTogetherPairsAction(input)).toMatchObject({ ok: true, data: { stayTogetherPairs: [["p1", "p2"]], version: 2 } });
  expect(await updateStayTogetherPairsAction({ ...input, pairs: [] })).toMatchObject({ ok: false });
});
it("rejects member edits, forged group IDs, outsider players and overlapping pairs", async () => {
  allowed = false;
  expect((await updateStayTogetherPairsAction(input)).ok).toBe(false);
  allowed = true;
  expect((await updateStayTogetherPairsAction({ ...input, groupId: "other" })).ok).toBe(false);
  expect((await updateStayTogetherPairsAction({ ...input, pairs: [["p1", "outside"]] })).ok).toBe(false);
  expect((await updateStayTogetherPairsAction({ ...input, pairs: [["p1", "p2"], ["p2", "p3"]] })).ok).toBe(false);
});
it("rejects starting a custom draft that conflicts with current pairs or group", async () => {
  await updateStayTogetherPairsAction(input);
  const start = { groupId: "g1", sessionId: "s1", sessionVersion: 2, seed: 1, idempotencyKey: "start-test", manualCourts: [{ courtNumber: 1, team1: ["p1", "p3"], team2: ["p2", "p4"] }], manualSitting: [] };
  expect((await startRoundAction(start)).ok).toBe(false);
  expect((await startRoundAction({ ...start, groupId: "other" })).ok).toBe(false);
  expect(repository.state.rounds).toHaveLength(0);
});

it.each(["attendance", "courts", "reshuffle"])("rejects a forged actual group on %s mutations", async kind => {
  const started = await startRoundAction({ groupId: "g1", sessionId: "s1", sessionVersion: 1, seed: 1, idempotencyKey: "start-valid" });
  if (!started.ok) throw new Error(started.error);
  const base = { groupId: "other", sessionId: "s1", sessionVersion: 2, idempotencyKey: "forged-group" };
  const before = structuredClone(repository.state);
  const result = kind === "attendance" ? await changeAttendanceAction({ ...base, playerId: "p1", present: false })
    : kind === "courts" ? await updateCourtConfigAction({ ...base, courtCount: 1, courtPlayerCounts: [4] })
    : await reshuffleRoundAction({ ...base, roundId: started.data.id, roundVersion: 1, seed: 2 });
  expect(result.ok).toBe(false);
  expect(repository.state).toEqual(before);
});
