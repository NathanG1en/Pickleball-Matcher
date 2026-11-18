import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setActionRepository } from "@/app/actions/action-context";
import { completeGoogleSignupAction } from "@/app/actions/player-account";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

const pending = vi.fn<() => Promise<{ email: string; name: string | null } | null>>();
const clearPending = vi.fn(async () => {});
const cookieJar = new Map<string, string>();
vi.mock("@/lib/auth/pending-google-signup", () => ({
  readPendingGoogleSignup: () => pending(),
  clearPendingGoogleSignup: () => clearPending(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: (name: string, value: string) => cookieJar.set(name, value), get: () => undefined, delete: () => {} }),
}));

const form = { username: "Nat_Plays", name: "Nathan", gender: "female", skillLevel: "advanced", initialRating: 4.2 };

describe("completeGoogleSignupAction", () => {
  let repo: InMemoryRepositories;
  beforeEach(() => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    repo = new InMemoryRepositories();
    setActionRepository(repo);
    cookieJar.clear();
    clearPending.mockClear();
    pending.mockResolvedValue({ email: "nathan@example.com", name: "Nathan G" });
  });
  afterEach(() => {
    setActionRepository(null);
    vi.unstubAllEnvs();
  });

  it("creates the account with the chosen details and the Google email, then signs in", async () => {
    const result = await completeGoogleSignupAction(form);

    expect(result.ok).toBe(true);
    const account = await repo.getPlayerAccountByUsername("nat_plays");
    expect(account).toMatchObject({ name: "Nathan", gender: "female", skillLevel: "advanced", email: "nathan@example.com", emailVerified: true, passwordHash: null });
    expect(account?.initialRating).toBeGreaterThan(1000);
    expect(cookieJar.has("player_session")).toBe(true);
    expect(clearPending).toHaveBeenCalled();
  });

  it("never takes the email from the form", async () => {
    const result = await completeGoogleSignupAction({ ...form, email: "someone-else@example.com" });
    expect(result.ok).toBe(false);
    expect(await repo.getPlayerAccountByEmail("someone-else@example.com")).toBeNull();
  });

  it("needs a gender to be chosen", async () => {
    const { gender: _omitted, ...withoutGender } = form;
    void _omitted;
    const result = await completeGoogleSignupAction(withoutGender);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.gender?.[0]).toBe("Choose male or female.");
  });

  it("refuses a taken username", async () => {
    await repo.createPlayerAccount({ id: "usr_taken", username: "nat_plays", name: "Other", skillLevel: "intermediate", initialRating: 1000, createdAt: new Date() });
    const result = await completeGoogleSignupAction(form);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.username?.[0]).toBe("That username is already taken.");
  });

  it("asks to start again when the Google sign-in has expired", async () => {
    pending.mockResolvedValue(null);
    const result = await completeGoogleSignupAction(form);
    expect(result).toEqual({ ok: false, error: "Your Google sign-in timed out. Go back and choose Continue with Google again." });
    expect(await repo.getPlayerAccountByUsername("nat_plays")).toBeNull();
  });

  it("signs into the existing account if that email was registered meanwhile", async () => {
    await repo.createPlayerAccount({ id: "usr_existing", username: "existing", name: "Existing", skillLevel: "intermediate", initialRating: 1000, email: "nathan@example.com", createdAt: new Date() });
    const result = await completeGoogleSignupAction(form);
    expect(result).toEqual({ ok: true, data: { accountId: "usr_existing" } });
    expect(await repo.getPlayerAccountByUsername("nat_plays")).toBeNull();
  });
});
