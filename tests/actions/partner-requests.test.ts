import { beforeEach, expect, it, vi } from "vitest";
import { submitPartnerRequestAction, cancelPartnerRequestAction, decidePartnerRequestAction, listPartnerRequestsAction } from "@/app/actions/partner-requests";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
let accountId: string | null = "account-a";
let guestId: string | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/actions/action-context", async original => ({ ...await original<typeof import("@/app/actions/action-context")>(),
  getActivePlayerAccountId: async () => accountId, getActiveGuestPlayerId: async () => guestId, getActiveOrganizerSession: async () => null }));
let repository: InMemoryRepositories;
const base = { groupId: "g", sessionId: "s" };
beforeEach(() => {
  accountId = "account-a"; guestId = null;
  repository = new InMemoryRepositories({ groups: [{ id: "g", name: "Club", ownerAccountId: "host", organizerPinHash: "fixture", createdAt: new Date() }], groupOrganizers: [{ groupId: "g", accountId: "secondary" }],
    players: ["a", "b", "c", "d"].map(id => ({ id, groupId: "g", name: id, accountId: `account-${id}`, active: true, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0 })),
    sessions: [{ id: "s", groupId: "g", courtCount: 1, currentRoundNumber: 0, status: "active", version: 1, startedAt: new Date(), endedAt: null }],
    attendance: ["a", "b", "c", "d"].map(playerId => ({ sessionId: "s", playerId, joinedRound: 1, leftRound: null })),
  });
  setActionRepository(repository);
});
it("derives requester identity, permits secondary organizer approval, and returns the new pair", async () => {
  const result = await submitPartnerRequestAction({ ...base, partnerPlayerId: "b" });
  if (!result.ok) throw new Error(result.error);
  expect(result.data.requests[0].requesterPlayerId).toBe("a");
  accountId = "secondary";
  const approved = await decidePartnerRequestAction({ ...base, requestId: result.data.requests[0].id, decision: "approved" });
  expect(approved).toMatchObject({ ok: true, data: { session: { stayTogetherPairs: [["a", "b"]] } } });
});
it("rejects impersonation, outsiders, forged groups and member approval", async () => {
  expect((await submitPartnerRequestAction({ ...base, partnerPlayerId: "b", requesterPlayerId: "c" })).ok).toBe(false);
  expect((await submitPartnerRequestAction({ ...base, groupId: "wrong", partnerPlayerId: "b" })).ok).toBe(false);
  const submitted = await submitPartnerRequestAction({ ...base, partnerPlayerId: "b" });
  if (!submitted.ok) throw new Error(submitted.error);
  const requestId = submitted.data.requests[0].id;
  expect((await decidePartnerRequestAction({ ...base, requestId, decision: "approved" })).ok).toBe(false);
  accountId = "outsider";
  expect((await listPartnerRequestsAction(base)).ok).toBe(false);
  expect((await submitPartnerRequestAction({ ...base, partnerPlayerId: "b" })).ok).toBe(false);
});
it("limits member visibility and cancellation to requests involving the authenticated player", async () => {
  const submitted = await submitPartnerRequestAction({ ...base, partnerPlayerId: "b" });
  if (!submitted.ok) throw new Error(submitted.error);
  const requestId = submitted.data.requests[0].id;
  accountId = "account-c";
  expect(await listPartnerRequestsAction(base)).toMatchObject({ ok: true, data: { requests: [] } });
  accountId = "account-b";
  expect((await cancelPartnerRequestAction({ ...base, requestId })).ok).toBe(false);
  expect(await listPartnerRequestsAction(base)).toMatchObject({ ok: true, data: { requests: [{ id: requestId }] } });
  accountId = "account-a";
  expect(await cancelPartnerRequestAction({ ...base, requestId })).toMatchObject({ ok: true, data: { requests: [{ status: "cancelled" }] } });
});
it("supports a verified guest identity without allowing anonymous roster impersonation", async () => {
  repository.state.players[0] = { ...repository.state.players[0], accountId: null };
  accountId = null;
  expect((await submitPartnerRequestAction({ ...base, partnerPlayerId: "b" })).ok).toBe(false);
  guestId = "a";
  expect((await submitPartnerRequestAction({ ...base, partnerPlayerId: "b" })).ok).toBe(true);
});

it("refreshes eligible participants even when attendance changes without a session version change", async () => {
  repository.state.attendance = repository.state.attendance.filter(row => row.playerId !== "b");
  const before = await listPartnerRequestsAction(base);
  expect(before).toMatchObject({ ok: true, data: { presentPlayerIds: ["a", "c", "d"] } });
  repository.state.attendance.push({ sessionId: "s", playerId: "b", joinedRound: 1, leftRound: null });
  const after = await listPartnerRequestsAction(base);
  expect(after).toMatchObject({ ok: true, data: { session: { version: 1 }, presentPlayerIds: ["a", "c", "d", "b"], players: [{ id: "a", name: "a" }, { id: "b", name: "b" }, { id: "c", name: "c" }, { id: "d", name: "d" }] } });
});
