import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionOptionsMenu } from "@/components/sessions/session-options-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/sessions", () => ({
  deleteSessionAction: vi.fn(async () => ({ ok: true, data: undefined })),
  duplicateSessionAction: vi.fn(async () => ({ ok: true, data: { id: "ses_dup" } })),
  updateSessionNameAction: vi.fn(async () => ({ ok: true })),
}));

describe("SessionOptionsMenu Component", () => {
  const groupId = "grp_test";
  const sessionId = "ses_test";

  it("renders the 3 dots button for session options", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu groupId={groupId} sessionId={sessionId} />
    );

    expect(html).toContain("···");
    expect(html).toContain('aria-label="Session options"');
    expect(html).toContain('data-testid="session-options-menu-button"');
    expect(html).toContain("h-7 w-7");
  });

  it("supports custom dataTestId", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        dataTestId="custom-session-menu-button"
      />
    );

    expect(html).toContain('data-testid="custom-session-menu-button"');
  });

  it("supports onRenamed prop and passes sessionName into component", () => {
    const handleRenamed = vi.fn();
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        sessionName="Championship Final"
        onRenamed={handleRenamed}
      />
    );

    expect(html).toContain('data-testid="session-options-menu-button"');
  });

  it("handles null/undefined sessionName gracefully without showing date defaults", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        sessionName={null}
      />
    );

    expect(html).toContain('data-testid="session-options-menu-button"');
  });

  it("confirms deletion with the session name when sessionName is provided", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        sessionName="Oct 27, 2026"
        initialDeleteModalOpen={true}
      />
    );

    expect(html).toContain("Delete Session");
    expect(html).toContain("Are you sure you want to delete the session &quot;Oct 27, 2026&quot;?");
  });

  it("confirms deletion using the formatted session date when sessionName is not set", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        sessionDate="2026-10-27T17:00:00.000Z"
        initialDeleteModalOpen={true}
      />
    );

    expect(html).toContain("Delete Session");
    expect(html).toContain("Are you sure you want to delete the session &quot;Oct 27, 2026&quot;?");
  });

  it("falls back to generic deletion message when neither sessionName nor sessionDate is provided", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        initialDeleteModalOpen={true}
      />
    );

    expect(html).toContain("Delete Session");
    expect(html).toContain("Are you sure you want to delete this session?");
  });

  it("renders Undo Round menu item when initialMenuOpen, onUndoLatestRound, and latestRoundNumber are set", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        initialMenuOpen={true}
        onUndoLatestRound={() => {}}
        latestRoundNumber={2}
      />
    );

    expect(html).toContain("Undo Round 2");
    expect(html).toContain('data-testid="undo-round-menu-item"');
  });

  it("does not render refresh chemistry or refresh synergy menu item", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        initialMenuOpen={true}
      />
    );

    expect(html).not.toContain("Refresh Chemistry");
    expect(html).not.toContain("Refresh Synergy");
    expect(html).not.toContain('data-testid="refresh-chemistry-menu-item"');
  });

  it("renders Rename Session, Duplicate Session, and Delete Session with design spec styling when open", () => {
    const html = renderToStaticMarkup(
      <SessionOptionsMenu
        groupId={groupId}
        sessionId={sessionId}
        initialMenuOpen={true}
      />
    );

    expect(html).toContain('data-testid="rename-session-menu-item"');
    expect(html).toContain("Rename Session");
    expect(html).toContain('data-testid="duplicate-session-menu-item"');
    expect(html).toContain("Duplicate Session");
    expect(html).toContain('data-testid="delete-session-menu-item"');
    expect(html).toContain("Delete Session");
    expect(html).toContain("text-[#E32929]");
    expect(html).toContain('role="separator"');
    expect(html).toContain("rounded-[20px]");
    expect(html).toContain("border-[2.5px]");
    expect(html).toContain("bg-[#FFFDF6]");
  });
});

