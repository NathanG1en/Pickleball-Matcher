import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import type { DomainRepository } from "@/lib/domain/repositories";

export const GOOGLE_OAUTH_COOKIE = "google_oauth_state";

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
  refresh_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return clientId;
}

export function getGoogleClientSecret(): string {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  }
  return clientSecret;
}

export function getGoogleRedirectUri(requestOrigin?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const base =
    requestOrigin
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.APP_URL
    ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(options: {
  state: string;
  nonce: string;
  redirectUri: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("nonce", options.nonce);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(options: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const params = new URLSearchParams({
    code: options.code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as GoogleTokens;
}

export async function getGoogleUserInfo(accessToken: string, idToken?: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok) {
    return (await response.json()) as GoogleUserInfo;
  }

  // Fallback: parse id_token payload if userinfo endpoint fails
  if (idToken) {
    try {
      const parts = idToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return {
          sub: payload.sub,
          name: payload.name,
          given_name: payload.given_name,
          family_name: payload.family_name,
          picture: payload.picture,
          email: payload.email,
          email_verified: payload.email_verified,
        };
      }
    } catch {
      // Ignore fallback decode errors
    }
  }

  throw new Error(`Failed to fetch Google userinfo (${response.status})`);
}

function sanitizeUsernameCandidate(candidate: string): string {
  const sanitized = candidate
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18);
  return sanitized.length >= 3 ? sanitized : `player_${randomBytes(2).toString("hex")}`;
}

export async function findOrCreateGooglePlayerAccount(
  repository: DomainRepository,
  profile: GoogleUserInfo,
): Promise<{ accountId: string; isNew: boolean }> {
  // 1. Look up existing OAuth link
  const existingOAuth = await repository.getOAuthAccount("google", profile.sub);
  if (existingOAuth) {
    return { accountId: existingOAuth.accountId, isNew: false };
  }

  const normalizedEmail = profile.email ? profile.email.trim().toLowerCase() : null;

  // 2. If an email was provided, check if a player account already exists with that email
  if (normalizedEmail) {
    const existingPlayer = await repository.getPlayerAccountByEmail(normalizedEmail);
    if (existingPlayer) {
      await repository.createOAuthAccount({
        id: `oacc_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        accountId: existingPlayer.id,
        provider: "google",
        providerUserId: profile.sub,
        email: normalizedEmail,
        createdAt: new Date(),
      });

      // If existing user was not email-verified and Google verified it, update verified status
      if (!existingPlayer.emailVerified && profile.email_verified) {
        await repository.updatePlayerAccountEmail(existingPlayer.id, normalizedEmail, true);
      }

      return { accountId: existingPlayer.id, isNew: false };
    }
  }

  // 3. Create a brand new player account
  const baseCandidate = sanitizeUsernameCandidate(
    profile.name || (normalizedEmail ? normalizedEmail.split("@")[0] : "player"),
  );

  let username = baseCandidate;
  let attempts = 0;
  while (await repository.getPlayerAccountByUsername(username)) {
    attempts += 1;
    username = `${baseCandidate.slice(0, 14)}_${randomBytes(2).toString("hex")}`;
    if (attempts > 10) {
      username = `usr_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
      break;
    }
  }

  const accountId = `usr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date();

  await repository.createPlayerAccount({
    id: accountId,
    username,
    name: profile.name?.trim() || username,
    gender: "male",
    passwordHash: null,
    skillLevel: "intermediate",
    initialRating: 1000,
    email: normalizedEmail,
    emailVerified: Boolean(profile.email_verified),
    createdAt: now,
  });

  await repository.createOAuthAccount({
    id: `oacc_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    accountId,
    provider: "google",
    providerUserId: profile.sub,
    email: normalizedEmail,
    createdAt: now,
  });

  return { accountId, isNew: true };
}

