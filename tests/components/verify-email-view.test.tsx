import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifyEmailView } from "@/components/players/verify-email-view";

describe("VerifyEmailView", () => {
  it("renders missing token error when no token is provided", () => {
    const html = renderToStaticMarkup(<VerifyEmailView />);
    expect(html).toContain("Missing verification token");
    expect(html).toContain("Go to Profile");
  });

  it("renders confirmation button when token is present", () => {
    const html = renderToStaticMarkup(<VerifyEmailView token="test-token-123" />);
    expect(html).toContain("Click the button below to complete verification");
    expect(html).toContain('data-testid="confirm-verify-email-button"');
    expect(html).toContain("Confirm Verification");
  });

  it("renders 6-digit OTP code input when no token is provided", () => {
    const html = renderToStaticMarkup(<VerifyEmailView />);
    expect(html).toContain("Have a 6-digit code?");
    expect(html).toContain("Verify Code");
  });
});

