import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecoveryEmailBanner } from "@/components/players/recovery-email-banner";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\u2011/g, "-").replace(/\s+/g, " ").trim();

describe("RecoveryEmailBanner", () => {
  it("asks for a recovery email in one short line when none is connected", () => {
    const html = renderToStaticMarkup(<RecoveryEmailBanner currentEmail={null} isVerified={false} />);

    expect(text(html)).toBe("Add a recovery email So you can reset your password if you forget it. Not now Add email →");
  });

  it("is one compact strip: title, the email, two small links and Enter code", () => {
    const html = renderToStaticMarkup(<RecoveryEmailBanner currentEmail="player@example.com" isVerified={false} />);

    expect(text(html)).toBe("Recovery email not verified player@example.com Resend code · Change email Enter code →");
    // An envelope icon in a tile, hidden from screen readers since the heading says it all
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><svg/);
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
