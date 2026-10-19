import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionOptionsMenu } from "@/components/sessions/session-options-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/sessions", () => ({
  deleteSessionAction: vi.fn(async () => ({ ok: true, data: undefined })),
  duplicateSessionAction: vi.fn(async () => ({ ok: true, data: { id: "ses_dup" } })),
}));

describe("SessionOptionsMenu Component", () => {
  const groupId = "grp_test";
  const sessionId = "ses_test";

  it("renders the 3 dots button for session options", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu groupId={groupId} sessionId={sessionId} />
    );

    expect(html).toContain("···");
    expect(html).toContain('aria-label="Session options"');
    expect(html).toContain('data-testid="session-options-menu-button"');
  });

  it("supports custom dataTestId", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        dataTestId="custom-session-menu-button"
      />
    );

    expect(html).toContain('data-testid="custom-session-menu-button"');
  });
});

