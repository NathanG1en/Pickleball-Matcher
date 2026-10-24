import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditGuestModal } from "@/components/groups/edit-guest-modal";
import type { PlayerRecord } from "@/lib/domain/types";

describe("EditGuestModal component", () => {
  const sampleGuest: PlayerRecord = {
    id: "guest-1",
    groupId: "group-1",
    name: "Guest Charlie",
    initialRating: 1000,
    rating: 1000,
    ratedGamesPlayed: 0,
    active: true,
    accountId: null,
  };

  it("renders nothing when isOpen is false or guestPlayer is null", () => {
    const htmlClosed = renderToStaticMarkup(
      <EditGuestModal
        isOpen={false}
        onClose={vi.fn()}
        guestPlayer={sampleGuest}
        groupId="group-1"
      />
    );
    expect(htmlClosed).toBe("");

    const htmlNull = renderToStaticMarkup(
      <EditGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={null}
        groupId="group-1"
      />
    );
    expect(htmlNull).toBe("");
  });

  it("renders modal with guest name in title and description", () => {
    const html = renderToStaticMarkup(
      <EditGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={sampleGuest}
        groupId="group-1"
      />
    );

    expect(html).toContain("Edit Guest");
    expect(html).toContain('Update details for guest &quot;Guest Charlie&quot;.');
    expect(html).toContain('value="Guest Charlie"');
    expect(html).toContain("Save Changes");
    expect(html).toContain("Cancel");
  });
});

