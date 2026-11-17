import { createNeonAuth } from "@neon/auth/next/server";

export const neonAuth = createNeonAuth({
  baseUrl:
    process.env.NEON_AUTH_BASE_URL ||
    "https://ep-cold-band-b491lrgj.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      "pickleball-neon-auth-cookie-secret-32-chars-long",
    sessionDataTtl: 300,
  },
  logLevel: "debug",
});
