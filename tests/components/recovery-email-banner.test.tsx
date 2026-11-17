import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecoveryEmailBanner } from "@/components/players/recovery-email-banner";

describe("RecoveryEmailBanner", () => {
  it("renders prompt to add recovery email when user has no email connected", () => {
    const html = renderToStaticMarkup(
      <RecoveryEmailBanner currentEmail={null} isVerified={false} />,
    );

    expect(html).toContain("Add Account Recovery Email");
    expect(html).toContain("You don&#x27;t have a recovery email attached yet");
    expect(html).toContain("Add Email");
    expect(html).toContain("Remind me later");
  });

  it("renders unverified warning when user has an email that is not verified", () => {
    const html = renderToStaticMarkup(
      <RecoveryEmailBanner currentEmail="player@example.com" isVerified={false} />,
    );

    expect(html).toContain("Action Required · Recovery Email Unverified");
    expect(html).toContain("player@example.com");
    expect(html).toContain("Change Email");
    expect(html).toContain("Dismiss");
  });

  it("renders nothing when user has a verified recovery email", () => {
    const html = renderToStaticMarkup(
      <RecoveryEmailBanner currentEmail="verified@example.com" isVerified={true} />,
    );

    expect(html).toBe("");
  });
});
