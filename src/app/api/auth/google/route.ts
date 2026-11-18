import { NextRequest, NextResponse } from "next/server";
import { getNeonAuthBaseUrl } from "@/lib/auth/neon-auth";

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

  const searchParams = request.nextUrl.searchParams;
  const next = sanitizeReturnPath(searchParams.get("next"));
  if (next) {
    loginUrl.searchParams.set("next", next);
  }

  const neonUrl = getNeonAuthBaseUrl();
  if (neonUrl) {
    const callbackUrl = encodeURIComponent(`${origin}/api/auth/callback/google${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    const authUrl = `${neonUrl}/sign-in/social?provider=google&callbackURL=${callbackUrl}`;
    return NextResponse.redirect(authUrl);
  }

  loginUrl.searchParams.set("error", "Google authentication is not configured yet. Configure Google OAuth in Neon Auth settings.");
  return NextResponse.redirect(loginUrl);
}

