"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getActionRepository, getActivePlayerAccountId, getActiveGuestPlayerId, getActiveOrganizerSession } from "./action-context";
import type { ActionResult } from "./auth";
import { DomainError } from "@/lib/domain/errors";
import { PartnerRequestService } from "@/lib/domain/partner-request-service";
import type { DomainRepository } from "@/lib/domain/repositories";
import type { PartnerRequestView, SessionRecord } from "@/lib/domain/types";
import { partnerRequestContextSchema, submitPartnerRequestSchema, cancelPartnerRequestSchema, decidePartnerRequestSchema } from "@/lib/validation/partner-requests";

type RequestContext = { repository: DomainRepository; session: SessionRecord; playerId: string | null; canManage: boolean };
async function resolveContext(groupId: string, sessionId: string): Promise<RequestContext> {
  const repository = getActionRepository();
  const session = await repository.getSession(sessionId);
  if (!session || session.groupId !== groupId) throw new DomainError("NOT_FOUND", "Session not found.");
  if (session.type === "open_play") throw new DomainError("INVALID_STATE", "Partner requests are available in normal sessions only.");
  const [accountId, guestId, organizerSession, players] = await Promise.all([
    getActivePlayerAccountId(), getActiveGuestPlayerId(groupId), getActiveOrganizerSession(), repository.listPlayers(groupId),
  ]);
  const player = accountId ? players.find(p => p.accountId === accountId && p.active) : players.find(p => p.id === guestId && p.active);
  const canManage = Boolean((accountId && await repository.isGroupOrganizer(groupId, accountId)) || organizerSession?.groupId === groupId);
  if (!player && !canManage) throw new DomainError("INVALID_STATE", "You must belong to this group to view partner requests.");
  return { repository, session, playerId: player?.id ?? null, canManage };
}
async function requestView(context: RequestContext): Promise<PartnerRequestView> {
  const [session, requests, players, attendance] = await Promise.all([
    context.repository.getSession(context.session.id), context.repository.listPartnerRequests(context.session.id),
    context.repository.listPlayers(context.session.groupId), context.repository.listAttendance(context.session.id),
  ]);
  if (!session) throw new DomainError("NOT_FOUND", "Session not found.");
  const activeIds = new Set(players.filter(player => player.active).map(player => player.id));
  return { session,
    players: players.map(({ id, name }) => ({ id, name })),
    presentPlayerIds: attendance.filter(row => row.leftRound === null && row.joinedRound <= session.currentRoundNumber + 1 && activeIds.has(row.playerId)).map(row => row.playerId),
    requests: context.canManage ? requests : requests.filter(request => request.requesterPlayerId === context.playerId || request.partnerPlayerId === context.playerId) };
}
function service(repository: DomainRepository) {
  return new PartnerRequestService(repository, { now: () => new Date(), nextRequestId: () => `request_${randomUUID()}` });
}
async function result(operation: () => Promise<PartnerRequestView>): Promise<ActionResult<PartnerRequestView>> {
  try { return { ok: true, data: await operation() }; }
  catch (error) {
    return { ok: false, error: error instanceof DomainError ? error.message : "Unable to update partner requests. Refresh and try again." };
  }
}
function refresh(session: SessionRecord) { revalidatePath(`/g/${session.groupId}/sessions/${session.id}`); }

export async function listPartnerRequestsAction(input: unknown): Promise<ActionResult<PartnerRequestView>> {
  const parsed = partnerRequestContextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid session." };
  return result(async () => requestView(await resolveContext(parsed.data.groupId, parsed.data.sessionId)));
}
export async function submitPartnerRequestAction(input: unknown): Promise<ActionResult<PartnerRequestView>> {
  const parsed = submitPartnerRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid partner." };
  return result(async () => {
    const context = await resolveContext(parsed.data.groupId, parsed.data.sessionId);
    if (!context.playerId) throw new DomainError("INVALID_STATE", "Join this session as a player before requesting a partner.");
    await service(context.repository).submit(context.session.id, context.playerId, parsed.data.partnerPlayerId);
    refresh(context.session);
    return requestView(context);
  });
}
export async function cancelPartnerRequestAction(input: unknown): Promise<ActionResult<PartnerRequestView>> {
  const parsed = cancelPartnerRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return result(async () => {
    const context = await resolveContext(parsed.data.groupId, parsed.data.sessionId);
    if (!context.playerId) throw new DomainError("INVALID_STATE", "Only the requester can cancel this request.");
    await service(context.repository).cancel(context.session.id, parsed.data.requestId, context.playerId);
    refresh(context.session);
    return requestView(context);
  });
}
export async function decidePartnerRequestAction(input: unknown): Promise<ActionResult<PartnerRequestView>> {
  const parsed = decidePartnerRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request decision." };
  return result(async () => {
    const context = await resolveContext(parsed.data.groupId, parsed.data.sessionId);
    if (!context.canManage) throw new DomainError("INVALID_STATE", "Only group organizers can approve or decline requests.");
    await service(context.repository).decide(context.session.id, parsed.data.requestId, parsed.data.decision);
    refresh(context.session);
    return requestView(context);
  });
}
