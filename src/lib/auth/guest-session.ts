import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const GUEST_SESSION_COOKIE = "guest_session";
const SESSION_ISSUER = "pickleball-matchmaker";
const SESSION_AUDIENCE = "pickleball-guest";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret =
    process.env.PLAYER_SESSION_SECRET ??
    process.env.ORGANIZER_SESSION_SECRET ??
    process.env.SESSION_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "fallback-development-session-secret-32-chars!!");
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("PLAYER_SESSION_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export interface GuestSessionData {
  guests: Record<string, string>;
}

export async function readGuestSession(token: string | undefined): Promise<GuestSessionData | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (payload.guests && typeof payload.guests === "object") {
      return { guests: payload.guests as Record<string, string> };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createGuestSessionToken(data: GuestSessionData): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({ guests: data.guests })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject("guest")
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(getSecret());
}

export const guestSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export async function recordGuestPlayer(groupId: string, playerId: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
    const existingData = await readGuestSession(existingToken);
    const guests = { ...(existingData?.guests ?? {}), [groupId]: playerId };
    const token = await createGuestSessionToken({ guests });
    cookieStore.set(GUEST_SESSION_COOKIE, token, guestSessionCookieOptions);
  } catch {
    // Non-request test contexts
  }
}

export async function getGuestPlayerIdForGroup(groupId: string): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
    const session = await readGuestSession(token);
    return session?.guests[groupId] ?? null;
  } catch {
    return null;
  }
}

