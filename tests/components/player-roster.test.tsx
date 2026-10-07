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
});
