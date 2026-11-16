import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import {
  buildGoogleAuthUrl,
  findOrCreateGooglePlayerAccount,
  isGoogleOAuthConfigured,
} from "@/lib/auth/google-oauth";

describe("Google OAuth layer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("Configuration & URL builder", () => {
    it("reports not configured when environment variables are missing", () => {
      vi.stubEnv("GOOGLE_CLIENT_ID", "");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
      expect(isGoogleOAuthConfigured()).toBe(false);
    });

    it("reports configured and constructs auth URL properly", () => {
      vi.stubEnv("GOOGLE_CLIENT_ID", "test-google-client-id");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-client-secret");
      expect(isGoogleOAuthConfigured()).toBe(true);

      const authUrl = buildGoogleAuthUrl({
        state: "test-state-123",
        nonce: "test-nonce-456",
        redirectUri: "http://localhost:3000/api/auth/google/callback",
      });

      const parsed = new URL(authUrl);
      expect(parsed.origin).toBe("https://accounts.google.com");
      expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
      expect(parsed.searchParams.get("client_id")).toBe("test-google-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
      expect(parsed.searchParams.get("state")).toBe("test-state-123");
      expect(parsed.searchParams.get("nonce")).toBe("test-nonce-456");
      expect(parsed.searchParams.get("scope")).toContain("openid");
      expect(parsed.searchParams.get("scope")).toContain("email");
    });
  });

  describe("findOrCreateGooglePlayerAccount", () => {
    it("creates a brand new player account and oauth link for first-time Google sign in", async () => {
      const repository = new InMemoryRepositories();

      const { accountId, isNew } = await findOrCreateGooglePlayerAccount(repository, {
        sub: "google-user-123",
        name: "Pickle Pro",
        email: "picklepro@gmail.com",
        email_verified: true,
      });

      expect(isNew).toBe(true);
      expect(accountId).toMatch(/^usr_/);

      const account = await repository.getPlayerAccount(accountId);
      expect(account).not.toBeNull();
      expect(account?.name).toBe("Pickle Pro");
      expect(account?.email).toBe("picklepro@gmail.com");
      expect(account?.emailVerified).toBe(true);
      expect(account?.passwordHash).toBeNull();
      expect(account?.initialRating).toBe(1000);

      const oauth = await repository.getOAuthAccount("google", "google-user-123");
      expect(oauth).not.toBeNull();
      expect(oauth?.accountId).toBe(accountId);
      expect(oauth?.provider).toBe("google");
      expect(oauth?.providerUserId).toBe("google-user-123");
    });

    it("links Google login to existing player account with matching email", async () => {
      const repository = new InMemoryRepositories();

      // Existing player registered with username and password
      await repository.createPlayerAccount({
        id: "usr_existing_123",
        username: "existing_player",
        name: "Existing Player",
        gender: "female",
        passwordHash: "existing-hash",
        skillLevel: "advanced",
        initialRating: 1100,
        email: "existing@example.com",
        emailVerified: false,
        createdAt: new Date(),
      });

      // Google sign-in with the same email
      const { accountId, isNew } = await findOrCreateGooglePlayerAccount(repository, {
        sub: "google-sub-999",
        name: "Existing Player",
        email: "existing@example.com",
        email_verified: true,
      });

      expect(isNew).toBe(false);
      expect(accountId).toBe("usr_existing_123");

      // Verify OAuth record was linked
      const oauth = await repository.getOAuthAccount("google", "google-sub-999");
      expect(oauth).not.toBeNull();
      expect(oauth?.accountId).toBe("usr_existing_123");

      // Verify account emailVerified status was upgraded to true
      const updatedAccount = await repository.getPlayerAccount("usr_existing_123");
      expect(updatedAccount?.emailVerified).toBe(true);
    });

    it("logs in directly when Google OAuth link is already established", async () => {
      const repository = new InMemoryRepositories();

      await repository.createPlayerAccount({
        id: "usr_google_linked",
        username: "linked_user",
        name: "Linked User",
        gender: "male",
        passwordHash: null,
        skillLevel: "intermediate",
        initialRating: 1000,
        email: "linked@example.com",
        emailVerified: true,
        createdAt: new Date(),
      });

      await repository.createOAuthAccount({
        id: "oacc_existing",
        accountId: "usr_google_linked",
        provider: "google",
        providerUserId: "google-sub-already-linked",
        email: "linked@example.com",
        createdAt: new Date(),
      });

      const { accountId, isNew } = await findOrCreateGooglePlayerAccount(repository, {
        sub: "google-sub-already-linked",
        email: "linked@example.com",
      });

      expect(isNew).toBe(false);
      expect(accountId).toBe("usr_google_linked");
    });
  });
});

