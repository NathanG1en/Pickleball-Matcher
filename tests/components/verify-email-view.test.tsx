import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifyEmailView } from "@/components/players/verify-email-view";

describe("VerifyEmailView", () => {
  it("renders the 6-digit code form with an email field when no email is known", () => {
    const html = renderToStaticMarkup(<VerifyEmailView />);
    expect(html).toContain("Verify Email</h1>");
    expect(html).toContain("Enter the 6-digit code from your verification email.");
    expect(html).toContain('id="verify-email-otp"');
    expect(html).toContain('id="verify-email-address"');
    expect(html).toContain("Verify Code");
    expect(html).toContain("Go to Profile");
  });

  it("says once where the code was sent, without a second instruction label", () => {
    const html = renderToStaticMarkup(<VerifyEmailView email="player@example.com" />);
    expect(html).toContain("We sent a 6-digit code to");
    expect(html).toContain("player@example.com");
    expect(html).not.toContain("Enter your 6-digit verification code");
    expect(html).not.toContain('id="verify-email-address"');
    expect(html).toContain("Verify Code");
  });

  it("offers a new code only to a signed-in player", () => {
    expect(renderToStaticMarkup(<VerifyEmailView email="player@example.com" />)).not.toContain("verify-email-resend");
    const html = renderToStaticMarkup(<VerifyEmailView email="player@example.com" canResend />);
    expect(html).toContain('data-testid="verify-email-resend"');
    expect(html).toContain("Send a new code");
  });

  it("pre-fills code input when a 6-digit code is provided in token prop", () => {
    const html = renderToStaticMarkup(
      <VerifyEmailView token="482719" email="player@example.com" />
    );
    const values = [...html.matchAll(/<input[^>]*value="([^"]*)"/g)].map((match) => match[1]);
    expect(values.slice(0, 6)).toEqual(["4", "8", "2", "7", "1", "9"]);
  });

  it("ignores a long link token instead of pre-filling it", () => {
    const html = renderToStaticMarkup(
      <VerifyEmailView token="1aef0b071a44bb434ec18563882c389e" email="player@example.com" />
    );
    const values = [...html.matchAll(/<input[^>]*value="([^"]*)"/g)].map((match) => match[1]);
    expect(values.slice(0, 6)).toEqual(["", "", "", "", "", ""]);
  });
});
