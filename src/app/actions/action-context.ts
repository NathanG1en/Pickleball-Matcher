import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { PLAYER_SESSION_COOKIE, readPlayerSession } from "@/lib/auth/player-session";

import { AuthorizationError, requireGroupOrganizer } from "@/lib/auth/authorize";
import { parseGroupOrganizerPermissions } from "@/lib/auth/group-permissions";
import {
  getOrganizerSessionSecret,
  ORGANIZER_SESSION_COOKIE,
  readOrganizerSession,
  type OrganizerSession,
} from "@/lib/auth/session";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { getDatabase } from "@/lib/db/server-database";
import type { DomainRepository } from "@/lib/domain/repositories";
import { SessionService } from "@/lib/domain/session-service";
import type { GroupRecord, GroupOrganizerPermissionKey, SessionServiceDependencies } from "@/lib/domain/types";

let testRepository: DomainRepository | null = null;

export function setActionRepository(repo: DomainRepository | null): void {
  testRepository = repo;
}

export function getActionRepository(): DomainRepository {
  if (testRepository) return testRepository;
  return new PostgresRepositories(getDatabase());
}

export const defaultDependencies: SessionServiceDependencies = {
  now: () => new Date(),
  nextId: (kind) => `${kind}_${randomUUID().slice(0, 12)}`,
  nextSeed: () => Math.floor(Math.random() * 0xffff_ffff),
};

export function getActionSessionService(): SessionService {
  return new SessionService(getActionRepository(), defaultDependencies);
}

export async function getActiveOrganizerSession(): Promise<OrganizerSession | null> {
  try {
    const secret = getOrganizerSessionSecret();
    const cookieStore = await cookies();
    const token = cookieStore.get(ORGANIZER_SESSION_COOKIE)?.value;
    if (!token) return null;
    return await readOrganizerSession(token, { secret });
  } catch {
    return null;
  }
}

export async function requireOrganizer(groupId: string): Promise<OrganizerSession | null> {
  const accountId = await getActivePlayerAccountId();
  if (accountId && await getActionRepository().isGroupOrganizer(groupId, accountId)) return null;
  const session = await getActiveOrganizerSession();
  return requireGroupOrganizer(groupId, session);
}

export async function requireGroupPermission(
  groupId: string,
  permission: GroupOrganizerPermissionKey,
): Promise<{ group: GroupRecord; accountId: string | null; isHost: boolean }> {
  const repository = getActionRepository();
  const group = await repository.getGroup(groupId);
  if (!group) throw new Error("Group not found");

  let accountId: string | null = null;
  try {
    accountId = (await getActivePlayerAccountId()) ?? null;
  } catch {
    accountId = null;
  }
  if (!accountId) {
    try {
      accountId = await requirePlayer();
    } catch {
      accountId = null;
    }
  }

  const isHost = Boolean(accountId && group.ownerAccountId === accountId);
  if (isHost) {
    return { group, accountId, isHost: true };
  }

  const isAccountOrg = Boolean(accountId && (await repository.isGroupOrganizer(groupId, accountId)));
  const session = await getActiveOrganizerSession();
  const isSessionOrg = Boolean(session && session.groupId === groupId);

  if (!isAccountOrg && !isSessionOrg) {
    throw new AuthorizationError();
  }

  const perms = parseGroupOrganizerPermissions(group.organizerPermissions);
  if (!perms[permission]) {
    throw new AuthorizationError();
  }

  return { group, accountId, isHost: false };
}

export async function requireGroupHost(
  groupId: string,
): Promise<{ group: GroupRecord; accountId: string }> {
  const accountId = await requirePlayer();
  const repository = getActionRepository();
  const group = await repository.getGroup(groupId);
  if (!group) throw new Error("Group not found");
  if (group.ownerAccountId !== accountId) {
    throw new AuthorizationError();
  }
  return { group, accountId };
}

export async function getActivePlayerAccountId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session = await readPlayerSession(cookieStore.get(PLAYER_SESSION_COOKIE)?.value);
    return session?.accountId ?? null;
  } catch {
    return null;
  }
}

export async function requirePlayer(): Promise<string> {
  const accountId = await getActivePlayerAccountId();
  if (!accountId) throw new Error("Not signed in");
  return accountId;
}

export async function getActiveGuestPlayerId(groupId: string): Promise<string | null> {
  try {
    const { getGuestPlayerIdForGroup } = await import("@/lib/auth/guest-session");
    return await getGuestPlayerIdForGroup(groupId);
  } catch {
    return null;
  }
}
