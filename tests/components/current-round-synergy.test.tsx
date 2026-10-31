import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrentRoundView } from "@/components/rounds/current-round";
import { SynergyRevealModal, SynergyPanel } from "@/components/rounds/synergy-reveal-modal";

describe("CurrentRoundView & SynergyRevealModal synergy display", () => {
  it("allows player to see their own partner synergy badge on their court", () => {
    const html = renderToStaticMarkup(
      <CurrentRoundView
        round={{ id: "r1", roundNumber: 1, status: "started", seed: 1 }}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        sittingPlayerIds={[]}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        currentViewerPlayerId="p1"
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
        pairSynergies={{ '["acc1","acc2"]': { score: 84, matchesPlayed: 10 } }}
      />
    );
    // Player's own team displays their partner synergy badge
    expect(html).toContain("+84% Synergy");
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
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
        pairSynergies={{ '["acc1","acc2"]': { score: 84, matchesPlayed: 10 } }}
      />
    );
    // Court cards don't render synergy badges for organizer (revealed only via panel)
    expect(html).not.toContain("+84% Synergy");
  });

  it("does not render partner synergies button directly in current round view as it was moved to session settings modal", () => {
    const html = renderToStaticMarkup(
      <CurrentRoundView
        round={{ id: "r1", roundNumber: 1, status: "started", seed: 1 }}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        sittingPlayerIds={[]}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        isOrganizer={true}
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
        pairSynergies={{ '["acc1","acc2"]': { score: 84, matchesPlayed: 10 } }}
      />
    );
    expect(html).not.toContain("Partner Synergies");
  });

  it("follows the same account pair across courts, team slots, and player order", () => {
    const html = renderToStaticMarkup(
      <CurrentRoundView
        round={{ id: "r2", roundNumber: 2, status: "proposed", seed: 2 }}
        courts={[{ courtNumber: 2, team1: ["p3", "p4"], team2: ["p2", "p1"] }]}
        sittingPlayerIds={[]}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
        currentViewerPlayerId="p1"
        pairSynergies={{ '["acc1","acc2"]': { score: 67, matchesPlayed: 1 } }}
      />
    );
    expect(html).toContain("+67% Synergy");
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
    expect(html).toContain("Court Synergy &amp; Chemistry");
    expect(html).toContain("+84% (10 games)");
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
    // Ineligibility warning banner is present in modal with dismiss button
    expect(html).toContain("Notice: Synergy Not Yet Available For Some Duos");
    expect(html).toContain('data-testid="dismiss-synergy-notice-button"');
    expect(html).toContain('aria-label="Dismiss synergy notice"');
    expect(html).toContain("Guest Players");
    expect(html).toContain("New Duos");

    // Team 1 with guest player shows ineligibility badge and explanation
    expect(html).toContain("Guest Ineligible");
    expect(html).toContain("GuestBob is a guest without an account");

    // Team 2 with 2 accounts but 0 matches shows New Duo
    expect(html).toContain("New Duo (0 games)");
    expect(html).toContain("First match together");
  });

  it("renders synergy cards directly inside SynergyPanel for session settings modal tab", () => {
    const html = renderToStaticMarkup(
      <SynergyPanel
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{
          1: {
            team1: { score: 90, matchesPlayed: 8, status: "calculated" },
            team2: { score: -10, matchesPlayed: 4, status: "calculated" },
          },
        }}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
      />
    );
    expect(html).toContain("Court 1");
    expect(html).toContain("Alice &amp; Bob");
    expect(html).toContain("+90% (8 games)");
    expect(html).toContain("Charlie &amp; Dave");
    expect(html).toContain("-10% (4 games)");
  });

  it("allows the partner synergies notice to be dismissed, while still appearing for sessions where it applies", () => {
    // 1. In a session where it applies (uncalculated duos), the notice appears with an X button
    const appliesHtml = renderToStaticMarkup(
      <SynergyPanel
        sessionId="session-1"
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{}}
        playerNames={{ p1: "Alice", p2: "GuestBob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: null, p3: "acc3", p4: "acc4" }}
      />
    );
    expect(appliesHtml).toContain("Notice: Synergy Not Yet Available For Some Duos");
    expect(appliesHtml).toContain('data-testid="dismiss-synergy-notice-button"');

    // 2. When dismissed for session-1, the notice is hidden
    const dismissedHtml = renderToStaticMarkup(
      <SynergyPanel
        sessionId="session-1"
        initialDismissed={true}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{}}
        playerNames={{ p1: "Alice", p2: "GuestBob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: null, p3: "acc3", p4: "acc4" }}
      />
    );
    expect(dismissedHtml).not.toContain("Notice: Synergy Not Yet Available For Some Duos");
    expect(dismissedHtml).not.toContain('data-testid="dismiss-synergy-notice-button"');

    // 3. For another session (session-2) where it applies, it still appears
    const otherSessionHtml = renderToStaticMarkup(
      <SynergyPanel
        sessionId="session-2"
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{}}
        playerNames={{ p1: "Alice", p2: "GuestBob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: null, p3: "acc3", p4: "acc4" }}
      />
    );
    expect(otherSessionHtml).toContain("Notice: Synergy Not Yet Available For Some Duos");
    expect(otherSessionHtml).toContain('data-testid="dismiss-synergy-notice-button"');

    // 4. For a session where all duos are calculated (it does not apply), it does not appear
    const fullyCalculatedHtml = renderToStaticMarkup(
      <SynergyPanel
        sessionId="session-3"
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        courtSynergies={{
          1: {
            team1: { score: 80, matchesPlayed: 5, status: "calculated" },
            team2: { score: 60, matchesPlayed: 3, status: "calculated" },
          },
        }}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        playerAccounts={{ p1: "acc1", p2: "acc2", p3: "acc3", p4: "acc4" }}
      />
    );
    expect(fullyCalculatedHtml).not.toContain("Notice: Synergy Not Yet Available For Some Duos");
    expect(fullyCalculatedHtml).not.toContain('data-testid="dismiss-synergy-notice-button"');
  });
});
