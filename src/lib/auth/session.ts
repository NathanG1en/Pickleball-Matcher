import "server-only";

import { randomUUID } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

export const ORGANIZER_SESSION_COOKIE = "organizer_session";
export const DEFAULT_ORGANIZER_SESSION_TTL_SECONDS = 8 * 60 * 60;

const SESSION_ISSUER = "pickleball-matchmaker";
const SESSION_AUDIENCE = "pickleball-organizer";

export interface OrganizerSession {
  readonly groupId: string;
  readonly expiresAt: Date;
}

export interface OrganizerSessionCookie {
  readonly name: typeof ORGANIZER_SESSION_COOKIE;
  readonly value: string;
  readonly options: {
    readonly httpOnly: true;
    readonly secure: boolean;
    readonly sameSite: "lax";
    readonly path: "/";
    readonly maxAge: number;
  };
}

export interface CreateOrganizerSessionInput {
  readonly groupId: string;
  readonly secret: string;
  readonly now?: Date;
  readonly ttlSeconds?: number;
  readonly secure?: boolean;
}

export interface ReadOrganizerSessionOptions {
  readonly secret: string;
  readonly now?: Date;
}

function secretKey(secret: string): Uint8Array {
  const key = new TextEncoder().encode(secret);
  if (key.byteLength < 32) {
    throw new Error("Organizer session secret must contain at least 32 bytes");
  }
  return key;
}

function secureCookieDefault(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.SESSION_COOKIE_SECURE === "true";
}

export async function createOrganizerSession(
  input: CreateOrganizerSessionInput,
): Promise<{ readonly token: string; readonly cookie: OrganizerSessionCookie }> {
  const now = input.now ?? new Date();
  const ttlSeconds =
    input.ttlSeconds ?? DEFAULT_ORGANIZER_SESSION_TTL_SECONDS;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86_400) {
    throw new Error("Organizer session lifetime must be between 60 and 86400 seconds");
  }
  if (!input.groupId) throw new Error("Organizer session requires a group ID");

  const issuedAt = Math.floor(now.getTime() / 1_000);
  const token = await new SignJWT({ groupId: input.groupId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(input.groupId)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(secretKey(input.secret));

  return {
    token,
    cookie: {
      name: ORGANIZER_SESSION_COOKIE,
      value: token,
      options: {
        httpOnly: true,
        secure: input.secure ?? secureCookieDefault(),
        sameSite: "lax",
        path: "/",
        maxAge: ttlSeconds,
      },
    },
  };
}

export async function readOrganizerSession(
  token: string | null | undefined,
  options: ReadOrganizerSessionOptions,
): Promise<OrganizerSession | null> {
  const key = secretKey(options.secret);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      currentDate: options.now,
    });
    if (
      typeof payload.groupId !== "string" ||
      payload.sub !== payload.groupId ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      groupId: payload.groupId,
      expiresAt: new Date(payload.exp * 1_000),
    };
  } catch {
    return null;
  }
}
