import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EndSessionNowButton } from "@/components/groups/end-session-now-button";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/app/actions/sessions", () => ({
  endSessionAction: vi.fn(async () => ({ ok: true, data: { id: "ses_1", status: "completed" } })),
}));

vi.mock("@/app/actions/open-play", () => ({
  endOpenPlaySessionAction: vi.fn(async () => ({ ok: true, data: { id: "ses_open", status: "completed" } })),
}));

vi.mock("@/lib/animations/session-signoff", () => ({
  markSessionEnded: vi.fn(),
}));

describe("EndSessionNowButton Component", () => {
  const groupId = "grp_test";
  const sessionId = "ses_test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with red styling, full width, and correct button text", () => {
    const html = renderToStaticMarkup(
      <EndSessionNowButton groupId={groupId} sessionId={sessionId} />
    );

    expect(html).toContain('data-testid="end-session-now-button"');
    expect(html).toContain("End Session");
    expect(html).not.toContain("End Session Now");
    expect(html).toContain("bg-[#ff6b6b]");
    expect(html).toContain("text-black");
    expect(html).toContain("border-2 border-black");
    expect(html).toContain("w-full");
    expect(html).toContain("font-display");
    expect(html).toContain("uppercase");
  });

  it("renders correctly for open play sessions", () => {
    const html = renderToStaticMarkup(
      <EndSessionNowButton
        groupId={groupId}
        sessionId={sessionId}
        sessionType="open_play"
        sessionVersion={2}
      />
    );

    expect(html).toContain('data-testid="end-session-now-button"');
    expect(html).toContain("End Session");
    expect(html).toContain("bg-[#ff6b6b]");
  });
});
