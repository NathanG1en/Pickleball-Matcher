import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MergeGuestModal } from "@/components/groups/merge-guest-modal";
import type { PlayerRecord } from "@/lib/domain/types";

describe("MergeGuestModal component", () => {
  const guest1: PlayerRecord = {
    id: "guest-1",
    groupId: "group-1",
    name: "Guest Alice",
    initialRating: 1000,
    rating: 1000,
    ratedGamesPlayed: 2,
    active: true,
    accountId: null,
  };

  const guest2: PlayerRecord = {
    id: "guest-2",
    groupId: "group-1",
    name: "Guest Bob",
    initialRating: 1000,
    rating: 1050,
    ratedGamesPlayed: 3,
    active: true,
    accountId: null,
  };

  const memberPlayer: PlayerRecord = {
    id: "member-1",
    groupId: "group-1",
    name: "Member Dave",
    initialRating: 1200,
    rating: 1200,
    ratedGamesPlayed: 5,
    active: true,
    accountId: "acc-dave",
  };

  it("renders nothing when isOpen is false or guestPlayer is null", () => {
    const htmlClosed = renderToStaticMarkup(
      <MergeGuestModal
        isOpen={false}
        onClose={vi.fn()}
        guestPlayer={guest1}
        allPlayers={[guest1, guest2]}
        groupId="group-1"
      />
    );
    expect(htmlClosed).toBe("");

    const htmlNull = renderToStaticMarkup(
      <MergeGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={null}
        allPlayers={[guest1, guest2]}
        groupId="group-1"
      />
    );
    expect(htmlNull).toBe("");
  });

  it("renders merge form with auto-populated name and guest list", () => {
    const html = renderToStaticMarkup(
      <MergeGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={guest1}
        allPlayers={[guest1, guest2, memberPlayer]}
        groupId="group-1"
      />
    );

    expect(html).toContain("Merge Guest Players");
    expect(html).toContain("Merged Player Name");
    expect(html).toContain('value="Guest Alice"');
    // Shows only guest players, not member accounts
    expect(html).toContain("Guest Alice");
    expect(html).toContain("Guest Bob");
    expect(html).not.toContain("Member Dave");
    expect(html).toContain("Merge Players");
    expect(html).not.toContain("Use Name");
  });

  it("deduplicates guest candidates if allPlayers contains duplicates", () => {
    const html = renderToStaticMarkup(
      <MergeGuestModal
        isOpen={true}
        onClose={vi.fn()}
        guestPlayer={guest1}
        allPlayers={[guest1, guest2, guest2]}
        groupId="group-1"
      />
    );

    const occurrences = (html.match(/Guest Bob/g) || []).length;
    expect(occurrences).toBe(1);
  });
});

