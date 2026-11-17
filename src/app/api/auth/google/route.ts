import { NextRequest, NextResponse } from "next/server";
import { getNetlifyIdentityUrl } from "@/lib/auth/netlify-gotrue";

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

  const netlifyUrl = getNetlifyIdentityUrl();
  if (netlifyUrl) {
    const authUrl = `${netlifyUrl}/authorize?provider=google`;
    return NextResponse.redirect(authUrl);
  }

  loginUrl.searchParams.set("error", "Google authentication is not configured yet. Enable Google in Netlify Identity settings.");
  return NextResponse.redirect(loginUrl);
}

