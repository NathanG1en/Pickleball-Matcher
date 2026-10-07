import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CurrentRoundView } from "@/components/rounds/current-round";

const sampleProps = {
  round: {
    id: "r1",
    roundNumber: 1,
    status: "proposed" as const,
    seed: 42,
  },
  courts: [
    {
      courtNumber: 1,
      team1: ["p1", "p2"] as const,
      team2: ["p3", "p4"] as const,
    },
  ],
  sittingPlayerIds: ["p5"],
  playerNames: {
    p1: "Alice",
    p2: "Bob",
    p3: "Charlie",
    p4: "Diana",
    p5: "Evan",
  },
  canRegenerate: true,
};

describe("CurrentRoundView Component", () => {
  it("renders large court cards and sitting players presentation", () => {
    const html = renderToStaticMarkup(<CurrentRoundView {...sampleProps} />);

    expect(html).toContain("Court 1");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("Charlie");
    expect(html).toContain("Diana");
    expect(html).toContain("Sitting this round");
    expect(html).toContain("Evan");
  });

  it("shows regenerate only when canRegenerate is true", () => {
    const proposedHtml = renderToStaticMarkup(
      <CurrentRoundView {...sampleProps} canRegenerate={true} />
    );
    expect(proposedHtml).toContain("Regenerate Round");

    const startedHtml = renderToStaticMarkup(
      <CurrentRoundView
        {...sampleProps}
        round={{ ...sampleProps.round, status: "started" }}
        canRegenerate={false}
      />
    );
    expect(startedHtml).not.toContain("Regenerate Round");
  });

  it("includes start confirmation and mobile action placement", () => {
    const html = renderToStaticMarkup(<CurrentRoundView {...sampleProps} />);

    expect(html).toContain("mobile-action-bar");
    expect(html).toContain("Start Round");
  });

  it("renders lineup customization friction button in proposal draft", () => {
    const html = renderToStaticMarkup(<CurrentRoundView {...sampleProps} />);

    expect(html).toContain("Customize Lineup");
    expect(html).toContain("Proposal Draft");
  });
});
