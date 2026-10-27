import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { PartnerRequestService } from "@/lib/domain/partner-request-service";
import { SessionService } from "@/lib/domain/session-service";

const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 3, prepare: false, onnotice: () => {} });
afterAll(async () => { await sql.end(); });
it("serializes competing approvals, cancellation and manual pair edits without overlapping teams", async () => {
  // Only new randomly named fixtures in the verified TEST database are written.
  // Cleanup deletes this owned group and its cascading fixtures, never other records.
  const groupId = `grp_request_test_${randomUUID()}`;
  const repository = new PostgresRepositories(sql);
  const ids = ["a", "b", "c", "d"].map(letter => `ply_req_${letter}_${randomUUID()}`);
  let sequence = 0;
  const sessions = new SessionService(repository, { now: () => new Date(), nextId: kind => `${kind}_req_test_${randomUUID()}`, nextSeed: () => 1 });
  const requests = new PartnerRequestService(repository, { now: () => new Date(), nextRequestId: () => `request_test_${++sequence}_${randomUUID()}` });
  try {
    await repository.insertGroup({ id: groupId, name: `Request concurrency ${randomUUID()}`, organizerPinHash: "fixture", createdAt: new Date() });
    for (const id of ids) await repository.createPlayer({ id, groupId, name: id, active: true, rating: 1000, initialRating: 1000, ratedGamesPlayed: 0 });
    const session = await sessions.startSession({ groupId, courtCount: 1, playerIds: ids });
    const [first, second] = await Promise.all([requests.submit(session.id, ids[0], ids[1]), requests.submit(session.id, ids[2], ids[1])]);
    const decided = await Promise.allSettled([requests.decide(session.id, first.id, "approved"), requests.decide(session.id, second.id, "approved")]);
    expect(decided.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await repository.getSession(session.id))?.stayTogetherPairs).toHaveLength(1);
    expect((await repository.listPartnerRequests(session.id)).map(request => request.status).sort()).toEqual(["approved", "declined"]);

    const next = await sessions.startSession({ groupId, courtCount: 1, playerIds: ids });
    const cancelRequest = await requests.submit(next.id, ids[0], ids[1]);
    await Promise.allSettled([requests.cancel(next.id, cancelRequest.id, ids[0]), requests.decide(next.id, cancelRequest.id, "approved")]);
    const finalRequest = (await repository.getPartnerRequest(cancelRequest.id))!;
    expect(["cancelled", "approved"]).toContain(finalRequest.status);
    expect((await repository.getSession(next.id))?.stayTogetherPairs ?? []).toHaveLength(finalRequest.status === "approved" ? 1 : 0);

    const third = await sessions.startSession({ groupId, courtCount: 1, playerIds: ids });
    const manualRace = await requests.submit(third.id, ids[0], ids[1]);
    const results = await Promise.allSettled([
      sessions.updateStayTogetherPairs({ sessionId: third.id, sessionVersion: 1, pairs: [[ids[0], ids[2]]] }),
      requests.decide(third.id, manualRace.id, "approved"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await repository.getSession(third.id))?.stayTogetherPairs).toHaveLength(1);
  } finally { await sql`delete from groups where id = ${groupId}`; }
});
