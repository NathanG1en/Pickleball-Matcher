import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlayerRoster } from "@/components/players/player-roster";
import type { PlayerRecord } from "@/lib/domain/types";

const samplePlayers: readonly PlayerRecord[] = [
  {
    id: "p1",
    groupId: "g1",
    name: "Jordan Smith",
    initialRating: 1000,
    rating: 1050,
    ratedGamesPlayed: 5,
    active: true,
  },
  {
    id: "p2",
    groupId: "g1",
    name: "Taylor Swift",
    initialRating: 1000,
    rating: 980,
    ratedGamesPlayed: 3,
    active: false,
  },
];

describe("PlayerRoster Component", () => {
  it("renders player roster and delete button when onDeletePlayer is provided", () => {
    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={samplePlayers}
        onDeletePlayer={() => {}}
      />
    );

    expect(html).toContain("Jordan Smith");
    expect(html).toContain("Taylor Swift");
    expect(html).toContain("Delete");
  });

  it("does not render delete button when onDeletePlayer is omitted", () => {
    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={samplePlayers}
      />
    );

    expect(html).toContain("Jordan Smith");
    expect(html).not.toContain("Delete");
  });

  it("renders username as an underlined link in parentheses and renders View profile button for non-organizer", () => {
    const playerWithUsername: PlayerRecord = {
      id: "p3",
      groupId: "g1",
      name: "Alex Morgan",
      username: "alex_m",
      initialRating: 1000,
      rating: 1100,
      ratedGamesPlayed: 10,
      active: true,
    };

    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={[playerWithUsername]}
        canManage={false}
      />
    );

    expect(html).toContain("Alex Morgan");
    expect(html).toContain('href="/players/alex_m"');
    expect(html).toContain("@alex_m");
    expect(html).toContain("underline");
    expect(html).toContain("View profile");
  });

  it("renders search, filter, sort controls and pin buttons on the roster", () => {
    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={samplePlayers}
        canManage={true}
      />
    );

    // Search input
    expect(html).toContain('id="player-roster-search"');
    expect(html).toContain('placeholder="Search roster by name or @username..."');

    // Filter and Sort selects
    expect(html).toContain('id="player-roster-filter"');
    expect(html).toContain('id="player-roster-sort"');

    // Pin buttons for players
    expect(html).toContain('data-testid="pin-player-Jordan Smith"');
    expect(html).toContain('data-testid="pin-player-Taylor Swift"');
  });

  it("masks rating and gender for a private player when viewed by another user and only shows games played", () => {
    const privatePlayer: PlayerRecord = {
      id: "p_priv",
      groupId: "g1",
      name: "Secret Player",
      username: "secret_p",
      accountId: "acc_secret",
      gender: "female",
      initialRating: 1000,
      rating: 1250,
      ratedGamesPlayed: 8,
      active: true,
      isPublic: false,
      visibilitySettings: {
        profile: "only_you",
        activities: "only_you",
        ratingStats: "only_you",
        chemistry: "only_you",
        groups: "only_you",
      },
    };

    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={[privatePlayer]}
        canManage={false}
        currentAccountId="acc_other"
      />
    );

    expect(html).toContain("Secret Player");
    expect(html).toContain("@secret_p");
    expect(html).toContain("8 games");
    expect(html).not.toContain("Rating:");
    expect(html).not.toContain("female");
  });

  it("shows rating, gender, and games played for private player when viewed by that player themselves", () => {
    const privatePlayer: PlayerRecord = {
      id: "p_priv",
      groupId: "g1",
      name: "Secret Player",
      username: "secret_p",
      accountId: "acc_secret",
      gender: "female",
      initialRating: 1000,
      rating: 1250,
      ratedGamesPlayed: 8,
      active: true,
      isPublic: false,
      visibilitySettings: {
        profile: "only_you",
        activities: "only_you",
        ratingStats: "only_you",
        chemistry: "only_you",
        groups: "only_you",
      },
    };

    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={[privatePlayer]}
        canManage={false}
        currentAccountId="acc_secret"
      />
    );

    expect(html).toContain("Secret Player");
    expect(html).toContain("Rating:");
    expect(html).toContain("female");
    expect(html).toContain("8 games");
  });

  it("masks details for group_members visibility when viewed by a non-group member", () => {
    const groupMemberOnlyPlayer: PlayerRecord = {
      id: "p_grp",
      groupId: "g1",
      name: "Club Member",
      username: "club_m",
      accountId: "acc_club",
      gender: "male",
      initialRating: 1000,
      rating: 1150,
      ratedGamesPlayed: 4,
      active: true,
      isPublic: true,
      visibilitySettings: {
        profile: "group_members",
        activities: "group_members",
        ratingStats: "group_members",
        chemistry: "group_members",
        groups: "group_members",
      },
    };

    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={[groupMemberOnlyPlayer]}
        canManage={false}
        currentAccountId="acc_stranger"
        isGroupMember={false}
      />
    );

    expect(html).toContain("Club Member");
    expect(html).toContain("4 games");
    expect(html).not.toContain("Rating:");
    expect(html).not.toContain("male");
  });

  it("shows details for group_members visibility when viewed by a group member", () => {
    const groupMemberOnlyPlayer: PlayerRecord = {
      id: "p_grp",
      groupId: "g1",
      name: "Club Member",
      username: "club_m",
      accountId: "acc_club",
      gender: "male",
      initialRating: 1000,
      rating: 1150,
      ratedGamesPlayed: 4,
      active: true,
      isPublic: true,
      visibilitySettings: {
        profile: "group_members",
        activities: "group_members",
        ratingStats: "group_members",
        chemistry: "group_members",
        groups: "group_members",
      },
    };

    const html = renderToStaticMarkup(
      <PlayerRoster
        groupId="g1"
        players={[groupMemberOnlyPlayer]}
        canManage={false}
        currentAccountId="acc_teammate"
        isGroupMember={true}
      />
    );

    expect(html).toContain("Club Member");
    expect(html).toContain("Rating:");
    expect(html).toContain("male");
    expect(html).not.toContain("Private");
  });
});
