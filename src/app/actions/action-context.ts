import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { PLAYER_SESSION_COOKIE, readPlayerSession } from "@/lib/auth/player-session";

import { requireGroupOrganizer } from "@/lib/auth/authorize";
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
import type { SessionServiceDependencies } from "@/lib/domain/types";

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
