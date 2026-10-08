import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";

export const PLAYER_SESSION_COOKIE = "player_session";
const SESSION_ISSUER = "pickleball-matchmaker";
const SESSION_AUDIENCE = "pickleball-player";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): Uint8Array {
  const secret = process.env.PLAYER_SESSION_SECRET
    ?? process.env.ORGANIZER_SESSION_SECRET
    ?? process.env.SESSION_SECRET
    ?? (process.env.NODE_ENV === "production" ? undefined : "fallback-development-session-secret-32-chars!!");
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("PLAYER_SESSION_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function createPlayerSession(accountId: string) {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(accountId)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(getSecret());
}

export async function readPlayerSession(token: string | undefined): Promise<{ accountId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (typeof payload.accountId !== "string" || payload.sub !== payload.accountId) return null;
    return { accountId: payload.accountId };
  } catch {
    return null;
  }
}

export const playerSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
