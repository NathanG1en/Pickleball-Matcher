import "server-only";

import type { OrganizerSession } from "@/lib/auth/session";

export class AuthorizationError extends Error {
  readonly code = "NOT_AUTHORIZED";

  constructor() {
    super("Not authorized");
    this.name = "AuthorizationError";
  }
}

export function requireGroupOrganizer(
  groupId: string,
  session: OrganizerSession | null,
  now = new Date(),
): OrganizerSession {
  if (
    !session ||
    session.groupId !== groupId ||
    session.expiresAt.getTime() <= now.getTime()
  ) {
    throw new AuthorizationError();
  }

  return session;
}
