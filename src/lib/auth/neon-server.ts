import { createNeonAuth } from "@neon/auth/next/server";

/**
 * The server side of Neon Auth (Google sign-in). It needs both settings from the environment and
 * has no fallbacks: a missing value used to quietly send sign-ins to the test branch's Neon Auth
 * with a cookie secret that is public in this repo.
 *
 * It's created on first use rather than when the module loads, so builds and pages that never
 * touch Google sign-in keep working where Neon Auth isn't configured (CI, for example).
 */
type NeonAuth = ReturnType<typeof createNeonAuth>;

let instance: NeonAuth | null = null;

export function isNeonAuthServerConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL?.trim() && process.env.NEON_AUTH_COOKIE_SECRET?.trim());
}

export function getNeonAuth(): NeonAuth {
  if (instance) return instance;
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!baseUrl || !secret) {
    throw new Error("Neon Auth isn't configured: set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET.");
  }
  instance = createNeonAuth({
    baseUrl,
    cookies: { secret, sessionDataTtl: 300 },
    logLevel: "warn",
  });
  return instance;
}
