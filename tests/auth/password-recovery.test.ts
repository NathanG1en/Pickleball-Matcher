import { afterEach, describe, expect, it, vi } from "vitest";
import {
  playerLoginAction,
  playerSignupAction,
  requestPasswordResetAction,
  resetPasswordAction,
  updateRecoveryEmailAction,
  verifyEmailAction,
  resendVerificationEmailAction,
} from "@/app/actions/player-account";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import { createHash } from "node:crypto";
import * as actionContext from "@/app/actions/action-context";

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requirePlayer: vi.fn(),
  };
});

describe("Password recovery and email verification layer", () => {
  afterEach(() => {
    setActionRepository(null);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("creates account with recovery email and creates a verification token", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    const result = await playerSignupAction({
      username: "pickle_ace",
      name: "Pickle Ace",
      email: "ace@example.com",
      gender: "male",
      password: "secure-password-123",
      skillLevel: "intermediate",
      customRating: false,
      initialRating: 1_000,
    });

    expect(result.ok).toBe(true);
    const account = await repository.getPlayerAccountByUsername("pickle_ace");
    expect(account).not.toBeNull();
    expect(account?.email).toBe("ace@example.com");
    expect(account?.emailVerified).toBe(false);

    // Verify an email verification token was recorded
    expect(repository.state.emailVerificationTokens).toHaveLength(1);
    expect(repository.state.emailVerificationTokens[0]?.email).toBe("ace@example.com");
  });

  it("prevents registering an email that is already used by another account", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    await playerSignupAction({
      username: "player_one",
      name: "Player One",
      email: "shared@example.com",
      gender: "female",
      password: "password12345",
      skillLevel: "intermediate",
    });

    const duplicateResult = await playerSignupAction({
      username: "player_two",
      name: "Player Two",
      email: "shared@example.com",
      gender: "male",
      password: "password12345",
      skillLevel: "beginner",
    });

    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.fieldErrors?.email).toContain("That email is already registered.");
    }
  });

  it("handles password reset request and successfully updates password", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    await playerSignupAction({
      username: "reset_tester",
      name: "Reset Tester",
      email: "tester@example.com",
      gender: "male",
      password: "old-password-123",
      skillLevel: "advanced",
    });

    // Request reset by email
    const requestResult = await requestPasswordResetAction({
      identifier: "tester@example.com",
    });
    expect(requestResult.ok).toBe(true);
    expect(repository.state.passwordResetTokens).toHaveLength(1);

    const tokenRecord = repository.state.passwordResetTokens[0]!;

    // Test password reset with a bad token
    const badReset = await resetPasswordAction({
      token: "invalid-token",
      password: "brand-new-password-123",
    });
    expect(badReset.ok).toBe(false);

    // Test password reset with the correct token (we find the raw token match via hash)
    // To test, we can insert a known raw token
    const knownRawToken = "my-secure-one-time-token";
    const knownTokenHash = createHash("sha256").update(knownRawToken).digest("hex");
    await repository.createPasswordResetToken({
      id: "test_token_id",
      accountId: tokenRecord.accountId,
      tokenHash: knownTokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const resetSuccess = await resetPasswordAction({
      token: knownRawToken,
      password: "brand-new-password-123",
    });
    expect(resetSuccess.ok).toBe(true);

    // Old password should no longer work
    const oldLogin = await playerLoginAction({
      username: "reset_tester",
      password: "old-password-123",
    });
    expect(oldLogin.ok).toBe(false);

    // New password should work
    const newLogin = await playerLoginAction({
      username: "reset_tester",
      password: "brand-new-password-123",
    });
    expect(newLogin.ok).toBe(true);
  });

  it("allows existing users to add a recovery email and verify it", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    // Existing user signs up with no email
    const signup = await playerSignupAction({
      username: "legacy_user",
      name: "Legacy User",
      gender: "male",
      password: "legacy-password-123",
      skillLevel: "intermediate",
    });
    expect(signup.ok).toBe(true);

    const user = await repository.getPlayerAccountByUsername("legacy_user");
    expect(user?.email).toBeNull();
    expect(user?.emailVerified).toBe(false);

    vi.mocked(actionContext.requirePlayer).mockResolvedValue(user!.id);

    // User updates recovery email
    const updateResult = await updateRecoveryEmailAction({
      email: "legacy@example.com",
    });
    expect(updateResult.ok).toBe(true);

    const updatedUser = await repository.getPlayerAccountByUsername("legacy_user");
    expect(updatedUser?.email).toBe("legacy@example.com");
    expect(updatedUser?.emailVerified).toBe(false);

    // Test resending verification email
    const resendResult = await resendVerificationEmailAction();
    expect(resendResult.ok).toBe(true);

    // Simulate verification
    const rawVerifyToken = "known-verify-token";
    const verifyTokenHash = createHash("sha256").update(rawVerifyToken).digest("hex");
    await repository.createEmailVerificationToken({
      id: "vtok_test",
      accountId: user!.id,
      email: "legacy@example.com",
      tokenHash: verifyTokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const verifyResult = await verifyEmailAction({ token: rawVerifyToken });
    expect(verifyResult.ok).toBe(true);

    const verifiedUser = await repository.getPlayerAccountByUsername("legacy_user");
    expect(verifiedUser?.emailVerified).toBe(true);
  });

  it("surfaces delivery error when email sending fails during recovery email update or resend", async () => {
    vi.stubEnv("PLAYER_SESSION_SECRET", "player-session-secret-for-auth-tests-32-bytes");
    vi.stubEnv("RESEND_API_KEY", "re_test_dummy");
    const repository = new InMemoryRepositories();
    setActionRepository(repository);

    const signup = await playerSignupAction({
      username: "resend_fail_user",
      name: "Resend Fail User",
      gender: "female",
      password: "password-12345",
      skillLevel: "intermediate",
    });
    expect(signup.ok).toBe(true);

    const user = await repository.getPlayerAccountByUsername("resend_fail_user");
    vi.mocked(actionContext.requirePlayer).mockResolvedValue(user!.id);

    const originalFetch = global.fetch;
    try {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: "You can only send testing emails to your own email address.",
        }),
      });

      const updateResult = await updateRecoveryEmailAction({
        email: "unverified@external.com",
      });
      expect(updateResult.ok).toBe(false);
      if (!updateResult.ok) {
        expect(updateResult.error).toBe("You can only send testing emails to your own email address.");
      }

      const resendResult = await resendVerificationEmailAction();
      expect(resendResult.ok).toBe(false);
      if (!resendResult.ok) {
        expect(resendResult.error).toBe("You can only send testing emails to your own email address.");
      }
    } finally {
      global.fetch = originalFetch;
    }
  });
});

