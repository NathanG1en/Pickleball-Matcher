import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VerifyEmailView } from "@/components/players/verify-email-view";

describe("VerifyEmailView", () => {
  it("renders 6-digit OTP code input form", () => {
    const html = renderToStaticMarkup(<VerifyEmailView />);
    expect(html).toContain("Enter your 6-digit verification code");
    expect(html).toContain("Verify Code");
    expect(html).toContain("Go to Profile");
  });

  it("renders instructional prompt when email is provided", () => {
    const html = renderToStaticMarkup(<VerifyEmailView email="player@example.com" />);
    expect(html).toContain("player@example.com");
    expect(html).toContain("Enter your 6-digit verification code");
    expect(html).toContain("Verify Code");
  });

  it("pre-fills code input when a 6-digit code is provided in token prop", () => {
    const html = renderToStaticMarkup(
      <VerifyEmailView token="482719" email="player@example.com" />
    );
    expect(html).toContain("4");
    expect(html).toContain("8");
    expect(html).toContain("2");
    expect(html).toContain("Enter your 6-digit verification code");
  });
});
