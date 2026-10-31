import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { proposeRoundAction, startRoundAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { manualRequestCourts, seedSessionRequest, sessionStartInput, SessionRequestRepository } from "../fixtures/session-request";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/actions/action-context", async importOriginal => ({ ...await importOriginal<typeof import("@/app/actions/action-context")>(), requireOrganizer: async (groupId: string) => { if (groupId !== "batch-group") throw new Error("Not authorized"); } }));
let repository: SessionRequestRepository;
beforeEach(async () => { repository = new SessionRequestRepository(); await seedSessionRequest(repository); setActionRepository(repository); });
afterEach(() => setActionRepository(null));

it("reuses the authorized session while loading proposal inputs once", async () => {
  const result = await proposeRoundAction({ groupId: "batch-group", sessionId: "batch-session", sessionVersion: 1, seed: 42, temperature: 0 });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.courts).toHaveLength(4);
  expect(result.data.courts.flatMap(court => [...court.team1, ...court.team2])).not.toContain("inactive-player");
  expect(repository.reads).toEqual({ session: 1, players: 1, attendance: 1, rounds: 1 });
});

it.each([false, true])("keeps one preflight and one transaction session read when starting (manual: %s)", async manual => {
  const result = await startRoundAction({ ...sessionStartInput, ...(manual ? { manualCourts: manualRequestCourts, manualSitting: [] } : {}) });
  expect(result.ok).toBe(true);
  expect(repository.state.rounds).toHaveLength(1);
  expect(repository.state.matches).toHaveLength(4);
  expect(repository.reads.session).toBe(2);
});

it.each(["version", "ended"])("still rejects a %s change between authorization and the mutation transaction", async change => {
  repository.beforeTransaction = () => {
    if (change === "version") repository.state.sessions[0].version = 2;
    else repository.state.sessions[0].status = "completed";
  };
  const result = await startRoundAction({ ...sessionStartInput, manualCourts: manualRequestCourts, manualSitting: [] });
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toMatch(change === "version" ? /session changed/i : /session has ended/i);
  expect(repository.state.rounds).toHaveLength(0);
  expect(repository.state.matches).toHaveLength(0);
});

it("rejects an incorrectly scoped proposal before computing a lineup", async () => {
  const result = await proposeRoundAction({ groupId: "other-group", sessionId: "batch-session", sessionVersion: 1, seed: 42 });
  expect(result.ok).toBe(false);
  expect(repository.reads.players).toBe(0);
  expect(repository.state.rounds).toHaveLength(0);
});
