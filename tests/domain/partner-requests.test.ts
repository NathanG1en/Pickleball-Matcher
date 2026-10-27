import { beforeEach, expect, it, vi } from "vitest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { PartnerRequestService } from "@/lib/domain/partner-request-service";
let repository: InMemoryRepositories;
let service: PartnerRequestService;
beforeEach(() => {
  repository = new InMemoryRepositories({
    sessions: [{ id: "s", groupId: "g", status: "active", courtCount: 1, currentRoundNumber: 0, version: 1, startedAt: new Date(), endedAt: null }],
    players: ["a", "b", "c", "d"].map(id => ({ id, groupId: "g", name: id, active: true, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0 })),
    attendance: ["a", "b", "c", "d"].map(playerId => ({ sessionId: "s", playerId, joinedRound: 1, leftRound: null })),
  });
  let id = 0;
  service = new PartnerRequestService(repository, { now: () => new Date(), nextRequestId: () => `request-${++id}` });
});
it("submits a request without activating a pair and approves it exactly once", async () => {
  const request = await service.submit("s", "a", "b");
  expect(request.status).toBe("pending");
  expect((await repository.getSession("s"))?.stayTogetherPairs).toBeUndefined();
  const session = await service.decide("s", request.id, "approved");
  expect(session).toMatchObject({ stayTogetherPairs: [["a", "b"]], version: 2 });
  expect((await repository.getPartnerRequest(request.id))?.status).toBe("approved");
  await expect(service.decide("s", request.id, "approved")).rejects.toThrow(/pending/i);
  expect((await repository.getSession("s"))?.version).toBe(2);
});
it("allows only the requester to cancel and rejects subsequent decisions", async () => {
  const request = await service.submit("s", "a", "b");
  await expect(service.cancel("s", request.id, "b")).rejects.toThrow(/own/i);
  await service.cancel("s", request.id, "a");
  expect((await repository.getPartnerRequest(request.id))?.status).toBe("cancelled");
  await expect(service.decide("s", request.id, "approved")).rejects.toThrow(/pending/i);
});
it("treats retries as the same request, rejects reverse duplicates and a second outgoing request", async () => {
  const request = await service.submit("s", "a", "b");
  expect((await service.submit("s", "a", "b")).id).toBe(request.id);
  await expect(service.submit("s", "b", "a")).rejects.toThrow(/pending/i);
  await expect(service.submit("s", "a", "c")).rejects.toThrow(/pending/i);
  expect(await repository.listPartnerRequests("s")).toHaveLength(1);
});
it("declines without changing pairs and closes competing requests on approval", async () => {
  const first = await service.submit("s", "a", "b");
  const second = await service.submit("s", "c", "b");
  await service.decide("s", first.id, "approved");
  expect((await repository.getPartnerRequest(second.id))?.status).toBe("declined");
  const third = await service.submit("s", "c", "d");
  await service.decide("s", third.id, "declined");
  expect((await repository.getSession("s"))?.stayTogetherPairs).toEqual([["a", "b"]]);
});
it("rejects self, outsider, absent, ended and Open Play requests", async () => {
  await expect(service.submit("s", "a", "a")).rejects.toThrow();
  await expect(service.submit("s", "a", "outsider")).rejects.toThrow();
  repository.state.attendance[1].leftRound = 1;
  await expect(service.submit("s", "a", "b")).rejects.toThrow(/attend/i);
  repository.state.sessions[0].type = "open_play";
  await expect(service.submit("s", "a", "c")).rejects.toThrow(/normal/i);
  repository.state.sessions[0].status = "completed";
  await expect(service.submit("s", "a", "c")).rejects.toThrow(/ended/i);
});
it("rechecks attendance and existing pairs at approval without overwriting them", async () => {
  const request = await service.submit("s", "a", "b");
  repository.state.attendance[1].leftRound = 1;
  await expect(service.decide("s", request.id, "approved")).rejects.toThrow(/attend/i);
  repository.state.attendance[1].leftRound = null;
  repository.state.sessions[0] = { ...repository.state.sessions[0], stayTogetherPairs: [["b", "c"]] };
  await expect(service.decide("s", request.id, "approved")).rejects.toThrow(/paired|partner/i);
  expect((await repository.getPartnerRequest(request.id))?.status).toBe("pending");
  expect((await repository.getSession("s"))?.stayTogetherPairs).toEqual([["b", "c"]]);
});
it("rolls back pair creation if saving the request decision fails", async () => {
  const request = await service.submit("s", "a", "b");
  const before = structuredClone(repository.state);
  vi.spyOn(repository, "updatePartnerRequest").mockRejectedValueOnce(new Error("Storage failure"));
  await expect(service.decide("s", request.id, "approved")).rejects.toThrow("Storage failure");
  expect(repository.state).toEqual(before);
});

it("does not omit competing pending requests in a large queue", async () => {
  const older = { id: "older", sessionId: "s", requesterPlayerId: "c", partnerPlayerId: "b", status: "pending" as const, createdAt: new Date(0), resolvedAt: null, version: 1 };
  repository.state.partnerRequests = [...Array.from({ length: 101 }, (_, index) => ({ ...older, id: `other-${index}`, requesterPlayerId: `x-${index}`, partnerPlayerId: `y-${index}`, createdAt: new Date(1) })), older];
  const chosen = await service.submit("s", "a", "b");
  await service.decide("s", chosen.id, "approved");
  expect((await repository.getPartnerRequest("older"))?.status).toBe("declined");
});
