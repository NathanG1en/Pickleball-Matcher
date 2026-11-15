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
  const mockAccount = { username: "dinkmaster" };

  it("renders desktop and mobile navigation elements with the 4 core destinations when signed in", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);

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
    expect(html).toContain("@dinkmaster");

    // Desktop nav should exist and be hidden on mobile
    expect(html).toContain('aria-label="Desktop main navigation"');
    expect(html).toContain('hidden md:flex items-center gap-1.5');

    // Mobile bottom nav should exist
    expect(html).toContain('aria-label="Mobile bottom navigation"');

    // Top header is present across mobile and desktop, with profile hidden on mobile
    expect(html).toContain("sticky top-0");
    expect(html).toContain("hidden md:flex items-center gap-2");

    // Bottom navigation must NOT contain "Log Out"
    const bottomNavStart = html.indexOf('aria-label="Mobile bottom navigation"');
    const bottomNavHtml = html.slice(bottomNavStart);
    expect(bottomNavHtml).not.toContain("Log Out");
  });

  it("renders only branding and Sign In button when signed out, hiding navigation destinations and bottom bar", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={null} />);

    // Branding
    expect(html).toContain("Pickleball Matchmaker");

    // Sign in link on desktop
    expect(html).toContain('href="/player-login"');
    expect(html).toContain("Sign In");

    // Desktop nav and links to groups/players/profile should NOT exist
    expect(html).not.toContain('aria-label="Desktop main navigation"');
    expect(html).not.toContain('href="/players/groups"');
    expect(html).not.toContain('href="/players/find"');
    expect(html).not.toContain('href="/players"');

    // Mobile bottom nav should NOT exist
    expect(html).not.toContain('aria-label="Mobile bottom navigation"');
  });

  it("highlights Home as active when pathname is '/'", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);

    // Active tab in desktop nav has aria-current="page"
    expect(html).toMatch(/aria-current="page"[^>]*href="\/"/);
    // Groups, Players are not active
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/players\/groups"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/players\/find"/);
  });

  it("highlights Groups as active when pathname is '/players/groups' or inside a group", () => {
    currentPathname = "/players/groups";
    let html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players\/groups"/);

    currentPathname = "/g/grp-123";
    html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players\/groups"/);
  });

  it("highlights Players as active when pathname is '/players/find'", () => {
    currentPathname = "/players/find";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players\/find"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/"/);
  });

  it("highlights Profile as active when pathname is '/players'", () => {
    currentPathname = "/players";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);
    expect(html).toMatch(/aria-current="page"[^>]*href="\/players"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/"/);
  });

  it("displays player account avatar and username when signed in", () => {
    currentPathname = "/";
    const html = renderToStaticMarkup(
      <ResponsiveNavigation playerAccount={{ username: "dinkmaster" }} />,
    );

    expect(html).toContain("@dinkmaster");
    expect(html).toContain("D"); // Avatar initial
    expect(html).toContain('aria-label="Account options menu"');
  });

  it("hides mobile bottom navigation during live court sessions (/sessions/)", () => {
    currentPathname = "/g/grp-123/sessions/ses-456";
    const html = renderToStaticMarkup(<ResponsiveNavigation playerAccount={mockAccount} />);

    // Desktop header still renders for navigation, but mobile bottom nav is suppressed
    expect(html).not.toContain('aria-label="Mobile bottom navigation"');
  });
});
