import { NextResponse, type NextRequest } from "next/server";
import { getActionRepository } from "@/app/actions/action-context";
import { neonAuth } from "@/lib/auth/neon-server";
import { createPlayerSession, PLAYER_SESSION_COOKIE, playerSessionCookieOptions } from "@/lib/auth/player-session";
import { findOrCreatePlayerForVerifiedEmail } from "@/lib/auth/social-sign-in";

export const dynamic = "force-dynamic";

function safeReturnPath(path: string | null): string {
  if (path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) return path;
  return "/";
}

function backToLogin(request: NextRequest, next: string, message: string) {
  const loginUrl = new URL("/player-login", request.nextUrl.origin);
  if (next !== "/") loginUrl.searchParams.set("next", next);
  loginUrl.searchParams.set("error", message);
  return NextResponse.redirect(loginUrl);
}

/**
 * Where Google sign-in lands. `src/proxy.ts` has already swapped Neon Auth's one-time verifier for
 * a Neon session cookie, so the Google account's email can be read from that session here.
 */
export async function GET(request: NextRequest) {
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));

  let user: { email?: string | null; name?: string | null; emailVerified?: boolean } | undefined;
  try {
    const { data } = await neonAuth.getSession();
    user = data?.user;
  } catch (error) {
    console.error("Google sign-in: unable to read the Neon Auth session", error);
  }

  if (!user?.email) {
    return backToLogin(request, next, "Google sign-in didn't finish. Please try again.");
  }
  if (user.emailVerified === false) {
    return backToLogin(request, next, "Google didn't confirm that email address. Please try another account.");
  }

  try {
    const accountId = await findOrCreatePlayerForVerifiedEmail(getActionRepository(), {
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
    response.cookies.set(PLAYER_SESSION_COOKIE, await createPlayerSession(accountId), playerSessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Google sign-in: unable to open the player account", error);
    return backToLogin(request, next, "Couldn't sign you in with Google. Please try again.");
  }
}
