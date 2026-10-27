import type { DomainRepository } from "./repositories";
import type { PartnerRequestRecord, SessionRecord } from "./types";
import { DomainError } from "./errors";
import { canonicalPairs } from "@/lib/matchmaking/stay-together";

const invalid = (message: string): never => { throw new DomainError("INVALID_STATE", message); };

/** Caller actions enforce identity/organizer authorization; this service enforces transitions. */
export class PartnerRequestService {
  constructor(private readonly repository: DomainRepository, private readonly dependencies: { now(): Date; nextRequestId(): string }) {}

  private async activeSession(repository: DomainRepository, sessionId: string): Promise<SessionRecord> {
    const session = await repository.getSession(sessionId);
    if (!session) return invalid("Session not found.");
    if (session.status !== "active") return invalid("The session has ended.");
    if (session.type === "open_play") return invalid("Partner requests are available in normal sessions only.");
    return session;
  }
  private async eligible(repository: DomainRepository, session: SessionRecord, a: string, b: string): Promise<void> {
    if (a === b) return invalid("Choose a different player as your partner.");
    const [players, attendance] = await Promise.all([repository.listPlayers(session.groupId), repository.listAttendance(session.id)]);
    for (const id of [a, b]) {
      if (!players.some(player => player.id === id && player.active) || !attendance.some(item => item.playerId === id && item.leftRound === null && item.joinedRound <= session.currentRoundNumber + 1)) return invalid("Both players must currently attend this session.");
    }
    if ((session.stayTogetherPairs ?? []).some(pair => pair.includes(a) || pair.includes(b))) return invalid("One of these players already has a Stay Together partner. Ask an organizer to change the pair first.");
  }
  private async pending(repository: DomainRepository, sessionId: string, requestId: string): Promise<PartnerRequestRecord> {
    const request = await repository.getPartnerRequest(requestId);
    if (!request || request.sessionId !== sessionId) return invalid("Request not found in this session.");
    if (request.status !== "pending") return invalid("This request is no longer pending. Refresh to see the decision.");
    return request;
  }
  async submit(sessionId: string, requesterPlayerId: string, partnerPlayerId: string): Promise<PartnerRequestRecord> {
    return this.repository.transaction(async repository => {
      await repository.lockPartnerRequests(sessionId);
      const session = await this.activeSession(repository, sessionId);
      await this.eligible(repository, session, requesterPlayerId, partnerPlayerId);
      const pending = (await repository.listPartnerRequests(sessionId)).filter(request => request.status === "pending");
      const own = pending.find(request => request.requesterPlayerId === requesterPlayerId);
      if (own?.partnerPlayerId === partnerPlayerId) return own;
      if (own) return invalid("Cancel your pending request before asking for another partner.");
      if (pending.some(request => request.requesterPlayerId === partnerPlayerId && request.partnerPlayerId === requesterPlayerId)) return invalid("A request for this pair is already pending organizer approval.");
      const request: PartnerRequestRecord = { id: this.dependencies.nextRequestId(), sessionId, requesterPlayerId, partnerPlayerId, status: "pending", createdAt: this.dependencies.now(), resolvedAt: null, version: 1 };
      await repository.insertPartnerRequest(request);
      return request;
    });
  }
  async cancel(sessionId: string, requestId: string, requesterPlayerId: string): Promise<void> {
    await this.repository.transaction(async repository => {
      await repository.lockPartnerRequests(sessionId);
      await this.activeSession(repository, sessionId);
      const request = await this.pending(repository, sessionId, requestId);
      if (request.requesterPlayerId !== requesterPlayerId) return invalid("You can cancel only your own request.");
      await repository.updatePartnerRequest({ ...request, status: "cancelled", resolvedAt: this.dependencies.now(), version: request.version + 1 });
    });
  }
  async decide(sessionId: string, requestId: string, decision: "approved" | "declined"): Promise<SessionRecord> {
    return this.repository.transaction(async repository => {
      await repository.lockPartnerRequests(sessionId);
      const session = await this.activeSession(repository, sessionId);
      const request = await this.pending(repository, sessionId, requestId);
      let updated = session;
      const resolvedAt = this.dependencies.now();
      if (decision === "approved") {
        await this.eligible(repository, session, request.requesterPlayerId, request.partnerPlayerId);
        updated = { ...session, stayTogetherPairs: canonicalPairs([...(session.stayTogetherPairs ?? []), [request.requesterPlayerId, request.partnerPlayerId]]), version: session.version + 1 };
        await repository.updateSession(updated);
      }
      await repository.updatePartnerRequest({ ...request, status: decision, resolvedAt, version: request.version + 1 });
      if (decision === "approved") {
        const paired = new Set([request.requesterPlayerId, request.partnerPlayerId]);
        for (const other of await repository.listPartnerRequests(sessionId)) {
          if (other.status === "pending" && (paired.has(other.requesterPlayerId) || paired.has(other.partnerPlayerId))) {
            await repository.updatePartnerRequest({ ...other, status: "declined", resolvedAt, version: other.version + 1 });
          }
        }
      }
      return updated;
    });
  }
}
