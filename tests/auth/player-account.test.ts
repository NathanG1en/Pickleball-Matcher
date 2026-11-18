import { afterEach, describe, expect, it, vi } from "vitest";
import * as playerAccountActions from "@/app/actions/player-account";
import { playerLoginAction, playerSignupAction } from "@/app/actions/player-account";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

describe("player account authentication", () => {
  afterEach(() => {
    setActionRepository(null);
    vi.unstubAllEnvs();
  });

  it("creates accounts with a hashed password and the selected preset rating", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    const result = await playerSignupAction({
      username: "Court_Player",
      name: "Court Player",
      gender: "female",
      password: "secure-password-123",
      skillLevel: "advanced",
      customRating: false,
      initialRating: 1_000,
    });

    expect(result.ok).toBe(true);
    const created = await repository.getPlayerAccountByUsername("court_player");
    expect(created).toMatchObject({ username: "court_player", name: "Court Player", gender: "female", skillLevel: "advanced", initialRating: 1_100 });
    expect(created?.passwordHash).not.toBe("secure-password-123");
  });

  it("authenticates usernames without regard to capitalization and rejects a wrong password", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);
    await playerSignupAction({
      username: "rally_player",
      name: "Rally Player",
      password: "another-secure-password",
      skillLevel: "beginner",
      customRating: true,
      initialRating: 975,
    });

    const login = await playerLoginAction({ username: "RALLY_PLAYER", password: "another-secure-password" });
    const failure = await playerLoginAction({ username: "rally_player", password: "wrong-password" });

    expect(login.ok).toBe(true);
    expect(failure).toMatchObject({ ok: false, error: "Unable to sign in. Check your username or email and password." });
    expect((await repository.getPlayerAccountByUsername("rally_player"))?.initialRating).toBe(975);
  });

  it("authenticates with registered email address and rejects wrong passwords or unregistered emails", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);
    await playerSignupAction({
      username: "smash_ace",
      name: "Smash Ace",
      email: "Smash.Ace@example.com",
      password: "secure-password-456",
      skillLevel: "intermediate",
      customRating: false,
      initialRating: 1_000,
    });

    // Sign in using email via identifier field
    const loginViaIdentifier = await playerLoginAction({
      identifier: "smash.ace@example.com",
      password: "secure-password-456",
    });
    expect(loginViaIdentifier.ok).toBe(true);

    // Sign in using uppercase email via username field (backwards-compatible input)
    const loginViaUsername = await playerLoginAction({
      username: "SMASH.ACE@EXAMPLE.COM",
      password: "secure-password-456",
    });
    expect(loginViaUsername.ok).toBe(true);

    // Sign in using email via email field
    const loginViaEmail = await playerLoginAction({
      email: "smash.ace@example.com",
      password: "secure-password-456",
    });
    expect(loginViaEmail.ok).toBe(true);

    // Wrong password with email
    const wrongPassword = await playerLoginAction({
      identifier: "smash.ace@example.com",
      password: "wrong-password",
    });
    expect(wrongPassword).toMatchObject({
      ok: false,
      error: "Unable to sign in. Check your username or email and password.",
    });

    // Unregistered email
    const unknownEmail = await playerLoginAction({
      identifier: "unknown@example.com",
      password: "secure-password-456",
    });
    expect(unknownEmail).toMatchObject({
      ok: false,
      error: "Unable to sign in. Check your username or email and password.",
    });

    // Invalid / too short input
    const invalidInput = await playerLoginAction({
      identifier: "ab",
      password: "secure-password-456",
    });
    expect(invalidInput).toMatchObject({
      ok: false,
      error: "Enter a valid username or email and password.",
    });
  });

  it("reports a duplicate username alongside other signup field errors", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);
    await playerSignupAction({
      username: "court_player",
      name: "Court Player",
      password: "valid-password-123",
      skillLevel: "beginner",
      customRating: false,
      initialRating: 900,
    });

    const result = await playerSignupAction({
      username: "COURT_PLAYER",
      name: "Another Player",
      password: "short",
      skillLevel: "beginner",
      customRating: false,
      initialRating: 900,
    });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        username: ["That username is already taken."],
        password: [expect.any(String)],
      },
    });
  });

  it("rejects signup with an invalid or unselected gender", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    const result = await playerSignupAction({
      username: "valid_user",
      name: "Valid User",
      gender: "",
      password: "valid-password-123",
      skillLevel: "beginner",
      customRating: false,
      initialRating: 900,
    });

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        gender: ["Select your gender (male or female)."],
      },
    });
  });

  it("does not expose a server action that signs in by email alone", () => {
    // Anyone can call an exported server action, so an email-only sign-in action would let a
    // visitor sign in as any player. Google sign-in finishes on the server from the Neon session.
    expect("loginWithSocialAuthAction" in playerAccountActions).toBe(false);
  });
});
