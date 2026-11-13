import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }) }));
vi.mock("@/app/actions/player-account", () => ({
  joinPublicGroupAction: vi.fn(),
}));
vi.mock("@/components/players/player-profile-controls", () => ({ LeaveGroupButton: () => null }));

import { PublicGroupList } from "@/components/players/public-group-list";

describe("PublicGroupList empty states", () => {
  it("explains an empty directory and offers a next step instead of blaming the search", () => {
    const html = renderToStaticMarkup(<PublicGroupList groups={[]} isSignedIn query="" />);
    expect(html).toContain("No public groups yet");
    expect(html).toContain("Ask your organizer for an invite link");
    expect(html).toContain('href="/setup"');
    expect(html).toContain("Create a group");
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
