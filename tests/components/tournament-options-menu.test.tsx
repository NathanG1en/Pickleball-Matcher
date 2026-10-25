import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TournamentOptionsMenu } from "@/components/tournaments/tournament-options-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/tournaments", () => ({
  deleteTournamentAction: vi.fn(async () => ({ ok: true, data: undefined })),
  updateTournamentStatusAction: vi.fn(async () => ({ ok: true })),
}));

describe("TournamentOptionsMenu Component", () => {
  const groupId = "grp_test";
  const tournamentId = "tr_test";

  it("renders the 3 dots button for tournament options", () => {
    const html = renderToStaticMarkup(
      <TournamentOptionsMenu
        groupId={groupId}
        tournamentId={tournamentId}
        status="active"
      />
    );

    expect(html).toContain("···");
    expect(html).toContain('aria-label="Tournament options"');
    expect(html).toContain('data-testid="tournament-options-menu-button"');
  });

  it("supports custom dataTestId", () => {
    const html = renderToStaticMarkup(
      <TournamentOptionsMenu
        groupId={groupId}
        tournamentId={tournamentId}
        status="completed"
        dataTestId="custom-tournament-menu-button"
      />
    );

    expect(html).toContain('data-testid="custom-tournament-menu-button"');
  });

  it("accepts status completed and onToggleStatus callback", () => {
    const handleToggle = vi.fn();
    const html = renderToStaticMarkup(
      <TournamentOptionsMenu
        groupId={groupId}
        tournamentId={tournamentId}
        tournamentName="Club Championship"
        status="completed"
        onToggleStatus={handleToggle}
      />
    );

    expect(html).toContain('data-testid="tournament-options-menu-button"');
  });
});

