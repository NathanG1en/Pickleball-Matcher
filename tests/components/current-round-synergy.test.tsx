import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrentRoundView } from "@/components/rounds/current-round";
import { SynergyRevealModal } from "@/components/rounds/synergy-reveal-modal";

describe("CurrentRoundView & SynergyRevealModal synergy display", () => {
  it("keeps court cards clean and does NOT render synergy badges on courts", () => {
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
    // Court cards should not display synergy score badges
    expect(html).not.toContain("84% Synergy");
    expect(html).not.toContain("Synergy Paused");
    expect(html).not.toContain("Guest Duo");
  });

  it("renders reveal synergy button only for organizers", () => {
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

  it("displays the synergy score inside the reveal synergy modal card", () => {
    const html = renderToStaticMarkup(
      <SynergyRevealModal
        isOpen={true}
        onClose={() => {}}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{ 1: { team1: { score: 84, matchesPlayed: 10 } } }}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
      />
    );
    expect(html).toContain("⚡ Court Synergy &amp; Chemistry");
    expect(html).toContain("84% (10 games)");
    expect(html).toContain("Alice &amp; Bob");
  });
});
