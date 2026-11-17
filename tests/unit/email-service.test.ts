import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sendEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email/email-service";

describe("Email Service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses mock dispatch and returns local dev url when RESEND_API_KEY is not set", async () => {
    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test Subject",
      html: "<p>Test</p>",
      actionUrl: "http://localhost:3000/verify-email?token=xyz",
    });

    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^mock_/);
    expect(result.localDevUrl).toBe("http://localhost:3000/verify-email?token=xyz");
  });

  it("dispatches via Resend API when RESEND_API_KEY is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");
    vi.stubEnv("RESEND_FROM_EMAIL", "Pickleball <noreply@customdomain.com>");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg_resend_12345" }),
    });

    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test Subject",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("msg_resend_12345");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer re_test_key_123",
          "Content-Type": "application/json",
        },
        body: expect.stringContaining('"from":"Pickleball <noreply@customdomain.com>"'),
      }),
    );
  });

  it("surfaces provider error message when Resend returns an error response", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        statusCode: 403,
        message: "You can only send testing emails to your own email address (owner@example.com).",
        name: "validation_error",
      }),
    });

    const result = await sendEmail({
      to: "other@example.com",
      subject: "Verify Email",
      html: "<p>Verify</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You can only send testing emails to your own email address (owner@example.com).",
    );
  });

  it("dispatches via Cloudflare Email Sending REST API when configured", async () => {
    vi.stubEnv("CLOUDFLARE_EMAIL_TOKEN", "cf_token_123");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf_account_abc");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { id: "cf_msg_999" } }),
    });

    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test CF Subject",
      html: "<p>Test CF</p>",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("cf_msg_999");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/cf_account_abc/email/sending/send",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer cf_token_123",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("formats and dispatches password reset email", async () => {
    const result = await sendPasswordResetEmail({
      to: "player@example.com",
      name: "Pickle Pro",
      resetUrl: "http://localhost:3000/reset-password?token=abc",
    });

    expect(result.success).toBe(true);
    expect(result.localDevUrl).toBe("http://localhost:3000/reset-password?token=abc");
  });

  it("formats and dispatches email verification email", async () => {
    const result = await sendEmailVerificationEmail({
      to: "player@example.com",
      name: "Pickle Pro",
      verifyUrl: "http://localhost:3000/verify-email?token=xyz",
    });

    expect(result.success).toBe(true);
    expect(result.localDevUrl).toBe("http://localhost:3000/verify-email?token=xyz");
  });
});
