import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AttendanceManager } from "@/components/attendance/attendance-manager";

const mockStorage: Record<string, string> = {};
const storageMock: Storage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  },
  key: (index: number) => Object.keys(mockStorage)[index] || null,
  get length() {
    return Object.keys(mockStorage).length;
  },
};

const samplePlayers = [
  { id: "p1", name: "Alice", active: true, rating: 1000 },
  { id: "p2", name: "Bob", active: true, rating: 1000 },
  { id: "p3", name: "Charlie", active: true, rating: 1000 },
  { id: "p4", name: "Diana", active: true, rating: 1000 },
  { id: "p5", name: "Evan", active: true, rating: 1000 },
];

describe("AttendanceManager Component", () => {
  beforeEach(() => {
    storageMock.clear();
    Object.defineProperty(globalThis, "window", {
      value: {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        localStorage: storageMock,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });

  it("renders accessible labels and player count", () => {
    const html = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={1}
      />
    );

    expect(html).toContain("Alice");
    expect(html).toContain("4 players selected");
    expect(html).toContain("Available Courts");
    expect(html).toContain('aria-label="Court count"');
  });

  it("respects court increment and decrement bounds", () => {
    const minHtml = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={1}
      />
    );

    expect(minHtml).toContain('aria-label="Decrease courts"');
    expect(minHtml).toContain("disabled");

    const maxHtml = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={6}
      />
    );

    expect(maxHtml).toContain('aria-label="Increase courts"');
  });

  it("includes persistent thumb-reachable mobile action area", () => {
    const html = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={1}
      />
    );

    expect(html).toContain("mobile-action-bar");
    expect(html).toContain("Continue to Pairings");
  });

  it("renders guest player input with rating slider", () => {
    const html = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={1}
      />
    );

    expect(html).toContain('aria-label="Guest player name"');
    expect(html).toContain('aria-label="Guest Gender"');
    expect(html).toContain('aria-label="Guest Rating"');
    expect(html).toContain('data-testid="normal-session-guest-rating"');
    expect(html).toContain("3.50");
    expect(html).toContain("Advanced Intermediate");
    expect(html).toContain('data-testid="rating-tick-2"');
  });

  it("renders player search filter and pin buttons for each player", () => {
    const html = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={1}
      />
    );

    expect(html).toContain('data-testid="attendance-player-search"');
    expect(html).toContain('aria-label="Search players"');
    expect(html).toContain('data-testid="pin-player-Alice"');
    expect(html).toContain('data-testid="pin-player-Bob"');
    expect(html).toContain('aria-label="Pin Alice to top"');
  });

  it("turns the pin button black when pinned without displaying a little pin or text label next to the player name", () => {
    localStorage.setItem("pickleball_pinned_players_group-1", JSON.stringify(["p1"]));

    const html = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p1", "p2", "p3", "p4"]}
        courtCount={1}
      />
    );

    // Pin button goes black for pinned player (Alice)
    expect(html).toMatch(/<button[^>]*data-testid="pin-player-Alice"[^>]*class="[^"]*bg-black/);
    // Pin button is white for unpinned player (Bob)
    expect(html).toMatch(/<button[^>]*data-testid="pin-player-Bob"[^>]*class="[^"]*bg-white/);

    // No little pin icon or text badge next to the player's name
    expect(html).not.toContain('data-testid="pinned-indicator-Alice"');
    expect(html).not.toMatch(/<span[^>]*>Alice<\/span>\s*<span[^>]*>[^<]*Pinned<\/span>/);

    localStorage.removeItem("pickleball_pinned_players_group-1");
  });

  it("moves selected players to top of pinned tier and above nonpinned in the roster grid", () => {
    // Pin Alice (p1) and Bob (p2)
    localStorage.setItem("pickleball_pinned_players_group-1", JSON.stringify(["p1", "p2"]));

    // Select Bob (p2, pinned) and Diana (p4, unpinned)
    const html = renderToStaticMarkup(
      <AttendanceManager
        groupId="group-1"
        players={samplePlayers}
        selectedPlayerIds={["p2", "p4"]}
        courtCount={1}
      />
    );

    const bobIndex = html.indexOf('data-testid="player-card-Bob"');
    const aliceIndex = html.indexOf('data-testid="player-card-Alice"');
    const dianaIndex = html.indexOf('data-testid="player-card-Diana"');
    const charlieIndex = html.indexOf('data-testid="player-card-Charlie"');
    const evanIndex = html.indexOf('data-testid="player-card-Evan"');

    // 1. Bob (pinned & selected) is at the top of pinned
    expect(bobIndex).toBeLessThan(aliceIndex);
    // 2. Alice (pinned & unselected) is below selected pinned, but above unpinned
    expect(aliceIndex).toBeLessThan(dianaIndex);
    // 3. Diana (unpinned & selected) is above unpinned unselected
    expect(dianaIndex).toBeLessThan(charlieIndex);
    // 4. Charlie & Evan (unpinned & unselected, alphabetical)
    expect(charlieIndex).toBeLessThan(evanIndex);

    localStorage.removeItem("pickleball_pinned_players_group-1");
  });
});

