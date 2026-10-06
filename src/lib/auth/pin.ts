import "server-only";

import { compare, hash } from "bcryptjs";

const PIN_HASH_COST = 12;
const DUMMY_PIN_HASH =
  "$2b$12$yoKkl6R41eRMnWhvkZXPwee8aIS8qKjN5GbU0DiCsria7Dpjo5rDC";

export const ORGANIZER_LOGIN_FAILURE = "Unable to sign in";

export type OrganizerPinAuthentication =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: typeof ORGANIZER_LOGIN_FAILURE };

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, PIN_HASH_COST);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  try {
    return await compare(pin, pinHash);
  } catch {
    return false;
  }
}

export async function authenticateOrganizerPin(
  pin: string,
  storedHash: string | null,
): Promise<OrganizerPinAuthentication> {
  const matches = await verifyPin(pin, storedHash ?? DUMMY_PIN_HASH);

  if (!storedHash || !matches) {
    return { ok: false, error: ORGANIZER_LOGIN_FAILURE };
  }

  return { ok: true };
}
