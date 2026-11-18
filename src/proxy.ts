import { NextResponse, type NextRequest } from "next/server";
import { getNeonAuth, isNeonAuthServerConfigured } from "@/lib/auth/neon-server";

/**
 * Finishes Google sign-in. Neon Auth sends the browser back with a one-time verifier, and only its
 * middleware can swap that for a Neon session cookie. It runs on the Google return page alone, so
 * it never guards or slows any other route; player sign-in still uses the app's own session.
 * Without Neon Auth settings it steps aside, and the return page reports the sign-in didn't finish.
 */
let middleware: ((request: NextRequest) => Promise<Response> | Response) | null = null;

export default async function proxy(request: NextRequest) {
  if (!isNeonAuthServerConfigured()) return NextResponse.next();
  middleware ??= getNeonAuth().middleware({
    loginUrl: "/player-login",
    publicRoutes: ["/auth/google/complete"],
  }) as unknown as (request: NextRequest) => Promise<Response> | Response;
  return middleware(request);
}

export const config = {
  matcher: ["/auth/google/complete"],
};
