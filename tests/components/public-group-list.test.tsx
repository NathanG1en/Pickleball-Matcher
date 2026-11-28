import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }) }));
vi.mock("@/app/actions/player-account", () => ({
  joinPublicGroupAction: vi.fn(),
}));
vi.mock("@/components/players/player-profile-controls", () => ({
  LeaveGroupButton: () => <button type="button">Leave</button>,
}));

import { PublicGroupList } from "@/components/players/public-group-list";

describe("PublicGroupList empty states", () => {
  it("explains an empty directory and offers a next step instead of blaming the search", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[]} isSignedIn query="" />);
    expect(html).toContain("No public groups yet");
    expect(html).toContain("Ask your organizer for an invite link");
    // Signed-in players create groups from the page header, so the empty state has no second button
    expect(html).not.toContain('href="/setup"');
    expect(html).not.toContain("Create a group");
    expect(html).not.toContain("match");
  });

  it("sends signed-out visitors to account creation before group setup", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[]} isSignedIn={false} />);
    expect(html).toContain("Create an account");
    expect(html).toContain(`href="/player-signup?next=${encodeURIComponent("/setup")}"`);
  });

  it("names the query and offers to clear it when a search finds nothing", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[]} isSignedIn query="  Sunset  " />);
    expect(html).toContain("No groups match “Sunset”");
    expect(html).toContain("Clear search");
    expect(html).toContain('href="/players/groups"');
    expect(html).not.toContain("No public groups yet");
  });
});

describe("PublicGroupList group card responsive layout", () => {
  const sampleGroups = [
    {
      id: "grp-1",
      name: "Supercalifragilisticexpialidocious Long Island Pickleball Association",
      playerCount: 16,
      isMember: true,
      isOrganizer: false,
      isHost: false,
      isPublic: true,
      createdAt: new Date(),
    },
    {
      id: "grp-2",
      name: "Sunset Pickleball Club",
      playerCount: 4,
      isMember: true,
      isOrganizer: true,
      isHost: true,
      isPublic: true,
      createdAt: new Date(),
    },
    {
      id: "grp-3",
      name: "Metro Pickleball League",
      playerCount: 1,
      isMember: false,
      isOrganizer: false,
      isHost: false,
      isPublic: true,
      createdAt: new Date(),
    },
  ];

  it("renders 2-line clamped title with word breaking and without dynamic font shrinking", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[sampleGroups[0]!]} isSignedIn />);
    // Check line clamp and break words classes
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("break-words");
    expect(html).toContain("[overflow-wrap:anywhere]");
    // Does not use premature single line truncation
    expect(html).not.toContain("truncate font-display");
    // Typography is bold condensed without font size reduction
    expect(html).toContain("font-display text-xl font-black uppercase");
  });

  it("places role badge alongside title in wrapping container and active player count directly beneath", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[sampleGroups[0]!]} isSignedIn />);
    expect(html).toContain("Member");
    expect(html).toContain("16 active players");
    // Verify flex-wrap on header container so badge wraps when necessary
    expect(html).toContain("flex items-center gap-2 flex-wrap");
    // Verify player count is underneath
    const titleIndex = html.indexOf("Supercalifragilisticexpialidocious");
    const badgeIndex = html.indexOf("Member");
    const countIndex = html.indexOf("16 active players");
    expect(titleIndex).toBeLessThan(badgeIndex);
    expect(badgeIndex).toBeLessThan(countIndex);
  });

  it("renders mobile-responsive separate action row where View Group expands and secondary actions stay compact", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[sampleGroups[0]!]} isSignedIn />);
    // Card container uses responsive column layout on mobile and row on desktop
    expect(html).toContain("flex flex-col sm:flex-row sm:items-center justify-between");
    // Action row is full width on mobile, auto on desktop
    expect(html).toContain("w-full sm:w-auto sm:shrink-0");
    // View Group takes available space on mobile (flex-1) and resets on desktop (sm:flex-initial)
    expect(html).toContain("flex-1 sm:flex-initial sm:w-auto");
    expect(html).toContain("View Group");
    // Leave action is secondary and compact
    expect(html).toContain("shrink-0");
    expect(html).toContain("Leave");
  });

  it("preserves Host badge and View Group full width row when no leave action is available", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[sampleGroups[1]!]} isSignedIn />);
    expect(html).toContain("Host");
    expect(html).not.toContain("Leave");
    expect(html).toContain("View Group");
    expect(html).toContain("flex-1 sm:flex-initial");
  });

  it("renders Join button as compact secondary action for non-members", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[sampleGroups[2]!]} isSignedIn />);
    expect(html).toContain("View Group");
    expect(html).toContain("Join");
    expect(html).toContain("1 active player");
  });
});
