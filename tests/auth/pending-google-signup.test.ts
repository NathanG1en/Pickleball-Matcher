import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPendingGoogleSignupToken, readPendingGoogleSignupToken } from "@/lib/auth/pending-google-signup";
import { createPlayerSession } from "@/lib/auth/player-session";
import { suggestUsernameForEmail } from "@/lib/auth/social-sign-in";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

describe("pending Google sign-up", () => {
  beforeEach(() => vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes"));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the Google email and name", async () => {
    const token = await createPendingGoogleSignupToken({ email: " Nathan@Example.com ", name: "Nathan G" });
    expect(await readPendingGoogleSignupToken(token)).toEqual({ email: "nathan@example.com", name: "Nathan G" });
  });

  it("rejects tampered tokens and player session tokens", async () => {
    const token = await createPendingGoogleSignupToken({ email: "nathan@example.com", name: null });
    const [header, , signature] = token.split(".");
    const forged = `${header}.${Buffer.from(JSON.stringify({ email: "victim@example.com" })).toString("base64url")}.${signature}`;
    expect(await readPendingGoogleSignupToken(forged)).toBeNull();
    expect(await readPendingGoogleSignupToken(await createPlayerSession("usr_1"))).toBeNull();
    expect(await readPendingGoogleSignupToken(undefined)).toBeNull();
  });
});

describe("suggestUsernameForEmail", () => {
  it("uses the part before the @ and avoids taken names", async () => {
    const repo = new InMemoryRepositories();
    expect(await suggestUsernameForEmail(repo, "Nathan.Glen04@gmail.com")).toBe("nathan_glen04");
    await repo.createPlayerAccount({ id: "usr_a", username: "nathan_glen04", name: "A", skillLevel: "intermediate", initialRating: 1000, createdAt: new Date() });
    expect(await suggestUsernameForEmail(repo, "nathan.glen04@gmail.com")).toBe("nathan_glen04_1");
    expect(await suggestUsernameForEmail(repo, "jo@x.com")).toBe("jo0");
  });
});
