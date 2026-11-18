import "server-only";

import { randomUUID } from "node:crypto";
import type { DomainRepository } from "@/lib/domain/repositories";

type SocialSignInRepository = Pick<
  DomainRepository,
  "getPlayerAccountByEmail" | "getPlayerAccountByUsername" | "createPlayerAccount"
>;

/**
 * Finds or creates the player account for an email that a sign-in provider (Google, through Neon
 * Auth) has already verified, and returns its id.
 *
 * This must only be called with an email taken from a verified provider session on the server,
 * never with an email sent by the browser: whoever controls the email gets the account.
 */
export async function findOrCreatePlayerForVerifiedEmail(
  repository: SocialSignInRepository,
  identity: { email: string; name?: string | null },
): Promise<string> {
  const email = identity.email.trim().toLowerCase();
  const existing = await repository.getPlayerAccountByEmail(email);
  if (existing) return existing.id;

  const baseUsername = email
    .split("@")[0]!
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 18)
    .padEnd(3, "0")
    .toLowerCase();
  let username = baseUsername;
  for (let counter = 1; await repository.getPlayerAccountByUsername(username); counter++) {
    username = `${baseUsername.slice(0, 14)}_${counter}`;
  }

  const id = `usr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await repository.createPlayerAccount({
    id,
    username,
    name: identity.name?.trim() || username,
    skillLevel: "intermediate",
    initialRating: 1000,
    email,
    emailVerified: true,
    passwordHash: null,
    createdAt: new Date(),
  });
  return id;
}
