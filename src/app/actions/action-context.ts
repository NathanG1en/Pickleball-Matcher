import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { requireGroupOrganizer } from "@/lib/auth/authorize";
import {
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
  const secret = process.env.ORGANIZER_SESSION_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) return null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ORGANIZER_SESSION_COOKIE)?.value;
    if (!token) return null;
    return await readOrganizerSession(token, { secret });
  } catch {
    return null;
  }
}

export async function requireOrganizer(groupId: string): Promise<OrganizerSession> {
  const session = await getActiveOrganizerSession();
  return requireGroupOrganizer(groupId, session);
}
