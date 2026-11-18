import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { neonTriggerEmailVerification } from "@/lib/auth/neon-auth";

type Call = { path: string; body: Record<string, unknown> };

describe("neonTriggerEmailVerification", () => {
  let calls: Call[];
  let respond: (path: string) => { ok: boolean; body?: unknown };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/neondb/auth");
    calls = [];
    respond = () => ({ ok: true, body: {} });
    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = url.toString().replace("https://auth.example.test/neondb/auth", "");
      calls.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
      const { ok, body } = respond(path);
      return { ok, json: async () => body ?? {} } as Response;
    }) as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("asks Neon for a code before signing up, so a known email still gets one", async () => {
    // Neon answers sign-up for a known email with a generic success and sends nothing, so the
    // code request has to come first; this is the "changed my email and back" bug.
    const result = await neonTriggerEmailVerification({ email: " Player@Example.com " });

    expect(result).toEqual({ success: true });
    expect(calls.map((call) => call.path)).toEqual(["/email-otp/send-verification-otp", "/sign-up/email"]);
    expect(calls[0]!.body).toEqual({ email: "player@example.com", type: "email-verification" });
  });

  it("never gives a Neon user the old fixed password", async () => {
    await neonTriggerEmailVerification({ email: "a@example.com" });
    await neonTriggerEmailVerification({ email: "b@example.com" });
    const passwords = calls.filter((call) => call.path === "/sign-up/email").map((call) => call.body.password);

    expect(passwords).not.toContain("TempPass123!Secure");
    expect(new Set(passwords).size).toBe(2);
    expect(String(passwords[0]).length).toBeGreaterThanOrEqual(40);
  });

  it("keeps the player's own password when one is given at sign-up", async () => {
    await neonTriggerEmailVerification({ email: "a@example.com", password: "their-own-password" });
    expect(calls.find((call) => call.path === "/sign-up/email")?.body.password).toBe("their-own-password");
  });

  it("reports failure only when Neon refuses both requests", async () => {
    respond = (path) => (path === "/sign-up/email" ? { ok: false, body: { message: "nope" } } : { ok: true });
    expect(await neonTriggerEmailVerification({ email: "a@example.com" })).toEqual({ success: true });

    respond = () => ({ ok: false, body: { message: "Too many requests" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await neonTriggerEmailVerification({ email: "a@example.com" })).toEqual({ success: false, error: "Too many requests" });
    consoleError.mockRestore();
  });
});
