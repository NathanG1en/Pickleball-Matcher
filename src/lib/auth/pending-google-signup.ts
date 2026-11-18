import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSecret, playerSessionCookieOptions } from "@/lib/auth/player-session";

/**
 * A first-time Google user's verified identity, held between the Google return page and the
 * "Finish your profile" form. It is signed and http-only, so the email the account is created
 * with always comes from Google through the server, never from the form.
 */
export const PENDING_GOOGLE_SIGNUP_COOKIE = "pending_google_signup";
const ISSUER = "pickleball-matchmaker";
const AUDIENCE = "pickleball-google-signup";
const TTL_SECONDS = 30 * 60;

export interface PendingGoogleSignup {
  email: string;
  name: string | null;
}

export const pendingGoogleSignupCookieOptions = { ...playerSessionCookieOptions, maxAge: TTL_SECONDS };

export async function createPendingGoogleSignupToken(identity: PendingGoogleSignup): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({ email: identity.email.trim().toLowerCase(), name: identity.name?.trim() || null })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(getSecret());
}

export async function readPendingGoogleSignupToken(token: string | undefined): Promise<PendingGoogleSignup | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;
    return { email: payload.email, name: typeof payload.name === "string" ? payload.name : null };
  } catch {
    return null;
  }
}

export async function readPendingGoogleSignup(): Promise<PendingGoogleSignup | null> {
  return readPendingGoogleSignupToken((await cookies()).get(PENDING_GOOGLE_SIGNUP_COOKIE)?.value);
}

export async function clearPendingGoogleSignup(): Promise<void> {
  (await cookies()).delete(PENDING_GOOGLE_SIGNUP_COOKIE);
}
