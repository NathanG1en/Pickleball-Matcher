import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerSearchDrawer } from "@/components/groups/player-search-drawer";

// Mock server actions and next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/actions/players", () => ({
  searchPlayersByUsernameAction: vi.fn().mockResolvedValue({
    ok: true,
    data: [],
  }),
  addPlayerByAccountIdAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { id: "p_1", name: "Alice", groupId: "grp_1" },
  }),
}));

describe("PlayerSearchDrawer", () => {
  it("renders search input with placeholder", () => {
    const html = renderToStaticMarkup(<PlayerSearchDrawer groupId="test_grp" onPlayerAdded={() => {}} />);
    expect(html).toContain("Search by @username or name...");
    expect(html).toContain("Find &amp; Add Players");
  });
});
