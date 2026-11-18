import { NextResponse, type NextRequest } from "next/server";
import { getNeonAuth } from "@/lib/auth/neon-server";

/**
 * Proxies the browser's Neon Auth calls, but only the ones Google sign-in needs.
 *
 * Players sign in with the app's own username and password. Neon Auth's own email sign-in and
 * sign-up must not be reachable through this domain: a Neon session here is trusted by
 * /auth/google/complete, which signs into the player account with that session's email. Email
 * codes are sent from the server straight to Neon Auth, not through this proxy.
 */
const ALLOWED = new Set(["POST sign-in/social", "GET get-session", "POST sign-out"]);

type Handlers = ReturnType<ReturnType<typeof getNeonAuth>["handler"]>;
type Handler = Handlers["GET"];
type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// Built on the first allowed request, so a missing Neon Auth setting fails that request with a
// clear error instead of breaking the build.
let handlers: Handlers | null = null;

function allowOnly(method: Method): Handler {
  return (async (request: NextRequest, context: Parameters<Handler>[1]) => {
    const path = request.nextUrl.pathname.replace(/^\/api\/auth\/?/, "");
    if (!ALLOWED.has(`${method} ${path}`)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    handlers ??= getNeonAuth().handler();
    return handlers[method](request, context);
  }) as Handler;
}

export const GET = allowOnly("GET");
export const POST = allowOnly("POST");
export const PUT = allowOnly("PUT");
export const DELETE = allowOnly("DELETE");
export const PATCH = allowOnly("PATCH");
