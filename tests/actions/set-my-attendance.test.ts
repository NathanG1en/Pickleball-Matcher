import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMyAttendanceAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import type { AttendanceRecord, PlayerRecord, SessionRecord } from "@/lib/domain/types";

const mockAccountId = vi.fn<() => Promise<string | null>>();
const mockGuestId = vi.fn<() => Promise<string | null>>();
vi.mock("@/app/actions/action-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/action-context")>()),
  getActivePlayerAccountId: () => mockAccountId(),
}));
vi.mock("@/lib/auth/guest-session", () => ({ getGuestPlayerIdForGroup: () => mockGuestId() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const player = (id: string, accountId: string | null): PlayerRecord => ({
  id, groupId: "g", name: id, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, accountId,
});

describe("setMyAttendanceAction", () => {
  let repo: InMemoryRepositories;
  const session: SessionRecord = { id: "s", groupId: "g", courtCount: 1, status: "active", currentRoundNumber: 2, startedAt: new Date(), endedAt: null, version: 3 };
  const attendance: AttendanceRecord[] = [
    { sessionId: "s", playerId: "p-jordan", joinedRound: 1, leftRound: null },
    { sessionId: "s", playerId: "p-guest", joinedRound: 1, leftRound: null },
  ];

  beforeEach(() => {
    repo = new InMemoryRepositories({
      players: [player("p-jordan", "acc-jordan"), player("p-guest", null), player("p-late", "acc-late")],
      sessions: [session],
      attendance,
    });
    setActionRepository(repo);
    mockAccountId.mockResolvedValue(null);
    mockGuestId.mockResolvedValue(null);
  });
  afterEach(() => setActionRepository(null));

  it("lets a signed-in player leave after the current round and come back", async () => {
    mockAccountId.mockResolvedValue("acc-jordan");
    expect(await setMyAttendanceAction({ groupId: "g", sessionId: "s", present: false })).toEqual({ ok: true, data: { leftRound: 3 } });
    expect((await repo.listAttendance("s")).find((a) => a.playerId === "p-jordan")?.leftRound).toBe(3);
    expect(await setMyAttendanceAction({ groupId: "g", sessionId: "s", present: true })).toEqual({ ok: true, data: { leftRound: null } });
  });

  it("works for a guest on the device they joined from", async () => {
    mockGuestId.mockResolvedValue("p-guest");
    const result = await setMyAttendanceAction({ groupId: "g", sessionId: "s", present: false });
    expect(result.ok).toBe(true);
  });

  it("refuses people who aren't on the roster or aren't checked in, and never takes a player id from the client", async () => {
    mockAccountId.mockResolvedValue("acc-stranger");
    expect(await setMyAttendanceAction({ groupId: "g", sessionId: "s", present: false })).toEqual({ ok: false, error: "You're not on this group's roster." });
    mockAccountId.mockResolvedValue("acc-late");
    const late = await setMyAttendanceAction({ groupId: "g", sessionId: "s", present: false });
    expect(late.ok).toBe(false);
    expect(await setMyAttendanceAction({ groupId: "g", sessionId: "s", present: false, playerId: "p-jordan" })).toEqual({ ok: false, error: "Invalid attendance request" });
  });
});
