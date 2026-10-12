import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LinkGuestModal } from "@/components/groups/link-guest-modal";
import type { PlayerRecord } from "@/lib/domain/types";

vi.mock("@/app/actions/players", () => ({
  searchPlayersByUsernameAction: vi.fn(),
  linkGuestPlayerAction: vi.fn(),
}));

describe("LinkGuestModal Component", () => {
  const sampleGuest: PlayerRecord = {
    id: "p_guest_1",
    groupId: "grp_1",
    name: "Alex Guest",
    initialRating: 1000,
    rating: 1000,
    ratedGamesPlayed: 0,
    active: true,
    accountId: null,
  };

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <LinkGuestModal
        isOpen={false}
        onClose={vi.fn()}
        guestPlayer={sampleGuest}
        groupId="grp_1"
      />
    );
    expect(html).toBe("");
  });

  it("renders nothing when guestPlayer is null even if isOpen is true", () => {
    const html = renderToStaticMarkup(
      <LinkGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={null}
        groupId="grp_1"
      />
    );
    expect(html).toBe("");
  });

  it("renders accessible dialog with guest player name and search form when open", () => {
    const html = renderToStaticMarkup(
      <LinkGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={sampleGuest}
        groupId="grp_1"
      />
    );

    // Dialog and ARIA attributes
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="link-guest-title"');

    // Header content
    expect(html).toContain("Link Guest Player");
    expect(html).toContain("Link Alex Guest");
    expect(html).toContain("Search for a registered public player account to link with Alex Guest");

    // Close button
    expect(html).toContain('aria-label="Close dialog"');

    // Search input
    expect(html).toContain('id="link-player-search-input"');
    expect(html).toContain('placeholder="Search username or name…"');

    // Cancel button
    expect(html).toContain("Cancel");
  });
});

