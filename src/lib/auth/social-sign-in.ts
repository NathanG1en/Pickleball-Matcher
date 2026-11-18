import "server-only";

import type { DomainRepository } from "@/lib/domain/repositories";

/**
 * A free username based on the part of an email before the @, for pre-filling the "Finish your
 * profile" form after a first Google sign-in. The player can change it before the account exists.
 */
export function usernameBaseFromEmail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .split("@")[0]!
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 18)
    .padEnd(3, "0");
}

export async function suggestUsernameForEmail(
  repository: Pick<DomainRepository, "getPlayerAccountByUsername">,
  email: string,
): Promise<string> {
  const base = usernameBaseFromEmail(email);
  let username = base;
  for (let counter = 1; await repository.getPlayerAccountByUsername(username); counter++) {
    username = `${base.slice(0, 14)}_${counter}`;
  }
  return username;
}
