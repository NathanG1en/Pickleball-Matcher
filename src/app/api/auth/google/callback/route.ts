import { NextRequest, NextResponse } from "next/server";
import { getActionRepository } from "@/app/actions/action-context";
import {
  createPlayerSession,
  PLAYER_SESSION_COOKIE,
  playerSessionCookieOptions,
} from "@/lib/auth/player-session";
import {
  exchangeGoogleCode,
  findOrCreateGooglePlayerAccount,
  getGoogleRedirectUri,
  getGoogleUserInfo,
  isGoogleOAuthConfigured,
  GOOGLE_OAUTH_COOKIE,
} from "@/lib/auth/google-oauth";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const loginUrl = new URL("/player-login", origin);

  const searchParams = request.nextUrl.searchParams;
  const oauthError = searchParams.get("error");
  if (oauthError) {
    loginUrl.searchParams.set("error", `Google sign-in was cancelled or failed (${oauthError}).`);
    return NextResponse.redirect(loginUrl);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    loginUrl.searchParams.set("error", "Missing OAuth authorization code or state.");
    return NextResponse.redirect(loginUrl);
  }

  const stateCookie = request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!stateCookie) {
    loginUrl.searchParams.set("error", "Google sign-in session expired. Please try again.");
    return NextResponse.redirect(loginUrl);
  }

  let cookieData: { state: string; nonce: string; next?: string | null };
  try {
    cookieData = JSON.parse(stateCookie);
  } catch {
    loginUrl.searchParams.set("error", "Invalid Google sign-in session. Please try again.");
    return NextResponse.redirect(loginUrl);
  }

  if (!cookieData.state || cookieData.state !== state) {
    loginUrl.searchParams.set("error", "Google sign-in verification failed (state mismatch). Please try again.");
    return NextResponse.redirect(loginUrl);
  }

  if (!isGoogleOAuthConfigured()) {
    loginUrl.searchParams.set("error", "Google authentication is not configured yet.");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const redirectUri = getGoogleRedirectUri(origin);
    const tokens = await exchangeGoogleCode({ code, redirectUri });
    const profile = await getGoogleUserInfo(tokens.access_token, tokens.id_token);

    if (!profile.sub) {
      loginUrl.searchParams.set("error", "Unable to retrieve Google profile.");
      return NextResponse.redirect(loginUrl);
    }

    const repository = getActionRepository();
    const { accountId } = await findOrCreateGooglePlayerAccount(repository, profile);

    const sessionToken = await createPlayerSession(accountId);

    const destination = cookieData.next && cookieData.next.startsWith("/") && !cookieData.next.startsWith("//")
      ? new URL(cookieData.next, origin)
      : new URL("/", origin);

    const response = NextResponse.redirect(destination);

    // Set player session cookie
    response.cookies.set(PLAYER_SESSION_COOKIE, sessionToken, playerSessionCookieOptions);

    // Clear state cookie
    response.cookies.delete(GOOGLE_OAUTH_COOKIE);

    return response;
  } catch (error) {
    loginUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Google authentication failed. Please try again.",
    );
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(GOOGLE_OAUTH_COOKIE);
    return response;
  }
}

