import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrentRoundView } from "@/components/rounds/current-round";
import { SynergyRevealModal } from "@/components/rounds/synergy-reveal-modal";

describe("CurrentRoundView & SynergyRevealModal synergy display", () => {
  it("allows player to see their own partner synergy badge on their court", () => {
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
    // Player's own team displays their partner synergy badge
    expect(html).toContain("84% Synergy");
    // Warning pills remain removed
    expect(html).not.toContain("Synergy Paused");
    expect(html).not.toContain("Guest Duo");
  });

  it("does not render synergy badges on other teams or when viewing as organizer", () => {
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
    // Court cards don't render synergy badges for organizer (revealed only via panel)
    expect(html).not.toContain("84% Synergy");
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
        courtSynergies={{
          1: {
            team1: { score: 84, matchesPlayed: 10, status: "calculated" },
            team2: { score: 72, matchesPlayed: 5, status: "calculated" },
          },
        }}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
      />
    );
    expect(html).toContain("⚡ Court Synergy &amp; Chemistry");
    expect(html).toContain("84% (10 games)");
    expect(html).toContain("Alice &amp; Bob");
    // All calculated -> no ineligibility notice
    expect(html).not.toContain("Notice: Synergy Not Yet Available For Some Duos");
  });

  it("warns in the modal card when synergy cannot be calculated for guest or new duo", () => {
    const html = renderToStaticMarkup(
      <SynergyRevealModal
        isOpen={true}
        onClose={() => {}}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{}}
        playerNames={{ p1: "Alice", p2: "GuestBob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: null, p3: "acc3", p4: "acc4" }}
      />
    );
    // Ineligibility warning banner is present in modal
    expect(html).toContain("Notice: Synergy Not Yet Available For Some Duos");
    expect(html).toContain("Guest Players");
    expect(html).toContain("New Duos");

    // Team 1 with guest player shows ineligibility badge and explanation
    expect(html).toContain("Guest Ineligible");
    expect(html).toContain("GuestBob is a guest without an account");

    // Team 2 with 2 accounts but 0 matches shows New Duo
    expect(html).toContain("New Duo (0 games)");
    expect(html).toContain("First match together");
  });
});
