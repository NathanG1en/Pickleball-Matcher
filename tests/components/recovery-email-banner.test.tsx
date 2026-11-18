import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecoveryEmailBanner } from "@/components/players/recovery-email-banner";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\u2011/g, "-").replace(/\s+/g, " ").trim();

describe("RecoveryEmailBanner", () => {
  it("asks for a recovery email in one short line when none is connected", () => {
    const html = renderToStaticMarkup(<RecoveryEmailBanner currentEmail={null} isVerified={false} />);

    expect(html).toContain("Add a recovery email");
    expect(html).toContain("So you can reset your password if you forget it.");
    expect(html).toContain("Add email →");
    expect(html).toContain("Not now");
  });

  it("keeps the unverified notice to a heading, one line and three actions", () => {
    const html = renderToStaticMarkup(<RecoveryEmailBanner currentEmail="player@example.com" isVerified={false} />);

    expect(text(html)).toBe(
      "Recovery email not verified Check player@example.com for your 6-digit verification code. Enter code → Resend code · Change email",
    );
    expect(html).toContain('href="/verify-email?email=player%40example.com"');
    // No eyebrow label, extra paragraph or dismiss link any more.
    expect(html).not.toContain("Action Required");
    expect(html).not.toContain("Dismiss");
  });

  it("renders nothing when user has a verified recovery email", () => {
    const html = renderToStaticMarkup(
      <RecoveryEmailBanner currentEmail="verified@example.com" isVerified={true} />,
    );

    expect(html).toBe("");
  });
});
