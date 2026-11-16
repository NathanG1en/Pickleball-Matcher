import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  buildGoogleAuthUrl,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured,
  GOOGLE_OAUTH_COOKIE,
} from "@/lib/auth/google-oauth";

function sanitizeReturnPath(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) {
    return path;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const loginUrl = new URL("/player-login", origin);

  if (!isGoogleOAuthConfigured()) {
    loginUrl.searchParams.set("error", "Google authentication is not configured yet.");
    return NextResponse.redirect(loginUrl);
  }

  const searchParams = request.nextUrl.searchParams;
  const next = sanitizeReturnPath(searchParams.get("next"));

  const state = randomBytes(24).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const redirectUri = getGoogleRedirectUri(origin);
  const authUrl = buildGoogleAuthUrl({ state, nonce, redirectUri });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_COOKIE, JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.SESSION_COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}

