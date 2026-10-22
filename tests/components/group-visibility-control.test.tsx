import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupVisibilityControl } from "@/components/groups/group-visibility-control";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("GroupVisibilityControl", () => {
  it("renders Public and Private toggle buttons with Public active when initialIsPublic is true", () => {
    const html = renderToStaticMarkup(<GroupVisibilityControl groupId="g1" initialIsPublic={true} />);

    expect(html).toContain("group-visibility-toggle");
    expect(html).toContain("group-visibility-public-button");
    expect(html).toContain("group-visibility-private-button");
    expect(html).toContain("Public");
    expect(html).toContain("Private");
    expect(html).toContain("group-visibility-info-button");
  });

  it("renders Public and Private toggle buttons with Private active when initialIsPublic is false", () => {
    const html = renderToStaticMarkup(<GroupVisibilityControl groupId="g1" initialIsPublic={false} />);

    expect(html).toContain("group-visibility-toggle");
    expect(html).toContain("group-visibility-public-button");
    expect(html).toContain("group-visibility-private-button");
    expect(html).toContain("Public");
    expect(html).toContain("Private");
    expect(html).toContain("group-visibility-info-button");
  });
});
