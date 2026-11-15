import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";

// Mock next/navigation
let currentPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("ResponsiveNavigation Component", () => {
  it("renders desktop and mobile navigation elements with the 4 core destinations", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);

    // Branding
    expect(html).toContain("Pickleball Matchmaker");

    // Desktop navigation links
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/players/groups"');
    expect(html).toContain('href="/players/find"');
    expect(html).toContain('href="/players"');

    // Labels
    expect(html).toContain("Home");
    expect(html).toContain("Groups");
    expect(html).toContain("Players");
    expect(html).toContain("Profile");

    // Desktop nav should exist
    expect(html).toContain('aria-label="Desktop main navigation"');

    // Mobile bottom nav should exist
    expect(html).toContain('aria-label="Mobile bottom navigation"');

    // Mobile top header should NOT exist
    expect(html).not.toContain("md:hidden sticky top-0");

    // Bottom navigation must NOT contain "Log Out"
    const bottomNavStart = html.indexOf('aria-label="Mobile bottom navigation"');
    const bottomNavHtml = html.slice(bottomNavStart);
    expect(bottomNavHtml).not.toContain("Log Out");
  });

  it("highlights Home as active when pathname is '/'", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);

    // Active tab in desktop nav has aria-current="page"
    expect(html).toMatch(/aria-current="page"[^>]*href="\/"/);
    // Groups, Players are not active
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/players\/groups"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/players\/find"/);
  });

  it("highlights Groups as active when pathname is '/players/groups' or inside a group", () => {
    currentPathname = "/players/groups";
    let html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players\/groups"/);

    currentPathname = "/g/grp-123";
    html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players\/groups"/);
  });

  it("highlights Players as active when pathname is '/players/find'", () => {
    currentPathname = "/players/find";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players\/find"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/"/);
  });

  it("highlights Profile as active when pathname is '/players'", () => {
    currentPathname = "/players";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/"/);
  });


  it("displays player account avatar and username when signed in", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(
      <ResponsiveNavigation playerAccount={{ id: "usr-1", username: "dinkmaster" }} />,
    );

    expect(html).toContain("@dinkmaster");
    expect(html).toContain("D"); // Avatar initial
    expect(html).toContain('aria-label="Account options menu"');
  });

  it("hides mobile bottom navigation during live court sessions (/sessions/)", () => {
    currentPathname = "/g/grp-123/sessions/ses-456";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);

    // Desktop header still renders for navigation, but mobile bottom nav is suppressed
    expect(html).not.toContain('aria-label="Mobile bottom navigation"');
  });
});
