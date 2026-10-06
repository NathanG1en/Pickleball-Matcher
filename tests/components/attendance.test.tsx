import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AttendanceManager } from "@/components/attendance/attendance-manager";

const samplePlayers = [
  { id: "p1", name: "Alice", active: true, rating: 1000 },
  { id: "p2", name: "Bob", active: true, rating: 1000 },
  { id: "p3", name: "Charlie", active: true, rating: 1000 },
  { id: "p4", name: "Diana", active: true, rating: 1000 },
  { id: "p5", name: "Evan", active: true, rating: 1000 },
];

describe("AttendanceManager Component", () => {
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
    expect(html).toContain("Start Session");
  });
});
