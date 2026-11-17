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

  it("uses mock dispatch when RESEND_API_KEY is not set", async () => {
    const result = await sendEmail({
      to: "player@example.com",
      subject: "Test Subject",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^mock_/);
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

  it("falls back to generic error message if Resend error response has no message", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const result = await sendEmail({
      to: "other@example.com",
      subject: "Verify Email",
      html: "<p>Verify</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to dispatch email via provider.");
  });

  it("handles network failure gracefully", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");

    global.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

    const result = await sendEmail({
      to: "player@example.com",
      subject: "Reset",
      html: "<p>Reset</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error delivering email.");
  });

  it("formats and dispatches password reset email", async () => {
    const result = await sendPasswordResetEmail({
      to: "player@example.com",
      name: "Pickle Pro",
      resetUrl: "https://example.com/reset?token=abc",
    });

    expect(result.success).toBe(true);
  });

  it("formats and dispatches email verification email", async () => {
    const result = await sendEmailVerificationEmail({
      to: "player@example.com",
      name: "Pickle Pro",
      verifyUrl: "https://example.com/verify?token=xyz",
    });

    expect(result.success).toBe(true);
  });
});
