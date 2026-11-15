import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PublicGroupsPage from "@/app/players/groups/page";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: vi.fn(),
  };
});

describe("PublicGroupsPage", () => {
  it("redirects to /player-login when signed out", async () => {
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(null);

    await expect(
      PublicGroupsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/player-login?next=%2Fplayers%2Fgroups");
  });

  it("renders public groups directory when signed in", async () => {
    const repo = new InMemoryRepositories({
      groups: [
        {
          id: "grp-1",
          name: "Metro Pickleball Club",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
        },
      ],
    });
    actionContext.setActionRepository(repo);
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue("usr-1");

    const jsx = await PublicGroupsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("Find a group");
    expect(html).toContain("Metro Pickleball Club");
    expect(html).toContain('href="/setup"');
    expect(html).toContain("Create Group");
    expect(html).not.toContain("Want to run your own sessions?");

    actionContext.setActionRepository(null);
  });
});

