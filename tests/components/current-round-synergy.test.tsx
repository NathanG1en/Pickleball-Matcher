import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrentRoundView } from "@/components/rounds/current-round";

describe("CurrentRoundView synergy badge", () => {
  it("renders partner synergy badge when viewer is on court with partner", () => {
    const html = renderToStaticMarkup(
      <CurrentRoundView
        round={{ id: "r1", roundNumber: 1, status: "started", seed: 1 }}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        sittingPlayerIds={[]}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        currentViewerPlayerId="p1"
        partnerSynergy={{ score: 84, matchesPlayed: 10 }}
      />
    );
    expect(html).toContain("84% Synergy");
  });

  it("renders reveal synergy button for organizers", () => {
    const html = renderToStaticMarkup(
      <CurrentRoundView
        round={{ id: "r1", roundNumber: 1, status: "started", seed: 1 }}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        sittingPlayerIds={[]}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        isOrganizer={true}
        courtSynergies={{ 1: { team1: { score: 84, matchesPlayed: 10 } } }}
      />
    );
    expect(html).toContain("Reveal Synergy");
  });
});
