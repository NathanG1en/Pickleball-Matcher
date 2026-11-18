import { neonAuth } from "@/lib/auth/neon-server";

/**
 * Finishes Google sign-in. Neon Auth sends the browser back with a one-time verifier, and only its
 * middleware can swap that for a Neon session cookie. It runs on the Google return page alone, so
 * it never guards or slows any other route; player sign-in still uses the app's own session.
 */
export default neonAuth.middleware({
  loginUrl: "/player-login",
  publicRoutes: ["/auth/google/complete"],
});

export const config = {
  matcher: ["/auth/google/complete"],
};
