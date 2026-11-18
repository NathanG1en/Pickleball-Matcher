import { NextResponse, type NextRequest } from "next/server";
import { neonAuth } from "@/lib/auth/neon-server";

/**
 * Proxies the browser's Neon Auth calls, but only the ones Google sign-in needs.
 *
 * Players sign in with the app's own username and password. Neon Auth's own email sign-in and
 * sign-up must not be reachable through this domain: a Neon session here is trusted by
 * /auth/google/complete, which signs into the player account with that session's email. Email
 * codes are sent from the server straight to Neon Auth, not through this proxy.
 */
const ALLOWED = new Set(["POST sign-in/social", "GET get-session", "POST sign-out"]);

const handler = neonAuth.handler();
type Handler = typeof handler.GET;

function allowOnly(method: string, forward: Handler): Handler {
  return (async (request: NextRequest, context: Parameters<Handler>[1]) => {
    const path = request.nextUrl.pathname.replace(/^\/api\/auth\/?/, "");
    if (!ALLOWED.has(`${method} ${path}`)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return forward(request, context);
  }) as Handler;
}

export const GET = allowOnly("GET", handler.GET);
export const POST = allowOnly("POST", handler.POST);
export const PUT = allowOnly("PUT", handler.PUT);
export const DELETE = allowOnly("DELETE", handler.DELETE);
export const PATCH = allowOnly("PATCH", handler.PATCH);
