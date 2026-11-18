import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const createNeonAuth = vi.fn(() => ({ handler: vi.fn(), getSession: vi.fn(), middleware: vi.fn() }));
vi.mock("@neon/auth/next/server", () => ({ createNeonAuth }));

async function load() {
  vi.resetModules();
  return import("@/lib/auth/neon-server");
}

describe("neon-server", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createNeonAuth.mockClear();
  });

  it("refuses to start without both Neon Auth settings instead of falling back", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "");
    const { getNeonAuth, isNeonAuthServerConfigured } = await load();
    expect(isNeonAuthServerConfigured()).toBe(false);
    expect(() => getNeonAuth()).toThrow("Neon Auth isn't configured: set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET.");
    expect(createNeonAuth).not.toHaveBeenCalled();

    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/neondb/auth");
    expect(() => getNeonAuth()).toThrow();
  });

  it("uses exactly the configured values, once", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/neondb/auth");
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "s".repeat(40));
    const { getNeonAuth, isNeonAuthServerConfigured } = await load();
    expect(isNeonAuthServerConfigured()).toBe(true);
    expect(getNeonAuth()).toBe(getNeonAuth());
    expect(createNeonAuth).toHaveBeenCalledTimes(1);
    expect(createNeonAuth).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "https://auth.example.test/neondb/auth", cookies: expect.objectContaining({ secret: "s".repeat(40) }) }),
    );
  });

  it("has no built-in auth server address or cookie secret", () => {
    const source = readFileSync("src/lib/auth/neon-server.ts", "utf8");
    expect(source).not.toMatch(/neonauth\.[a-z0-9.-]+\.neon\.tech/);
    expect(source).not.toContain("cookie-secret-32-chars");
  });
});
