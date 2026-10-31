import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ResultsEntryView } from "@/components/results/results-entry";

const sampleMatches = [
  {
    id: "m1",
    courtNumber: 1,
    team1Names: ["Alice", "Bob"] as [string, string],
    team2Names: ["Charlie", "Diana"] as [string, string],
    team1Score: 11,
    team2Score: 9,
    status: "completed" as const,
    version: 1,
  },
  {
    id: "m2",
    courtNumber: 2,
    team1Names: ["Evan", "Frank"] as [string, string],
    team2Names: ["Grace", "Hank"] as [string, string],
    team1Score: null,
    team2Score: null,
    status: "cancelled" as const,
    version: 1,
  },
];

describe("ResultsEntryView Component", () => {
  it("renders match score inputs with accessible labels", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
      />
    );

    expect(html).toContain("Court 1");
    expect(html).toContain("Court 2");
    expect(html).toContain('aria-label="Court 1 Team 1 score"');
    expect(html).toContain('aria-label="Court 1 Team 2 score"');
  });

  it("renders cancelled match state clearly", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
      />
    );

    expect(html).toContain("Cancelled");
  });

  it("displays per-court score errors when present", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{ m1: "Pickleball matches cannot end in a tie" }}
      />
    );

    expect(html).toContain("Pickleball matches cannot end in a tie");
    expect(html).toContain('role="alert"');
  });

  it("includes persistent thumb-reachable mobile action area", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
      />
    );

    expect(html).toContain("mobile-action-bar");
    expect(html).toContain("Next Round");
  });

  it("renders sitting players banner when sitting players exist", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        sittingNames={["George", "Hannah"]}
        canManage={true}
      />
    );

    expect(html).toContain("Sitting Out:");
    expect(html).toContain("George, Hannah");
    expect(html).not.toContain("+ Add Pickup Game");
  });

  it("renders Pickup Game badge when courtNumber exceeds courtCount", () => {
    const pickupMatches = [
      ...sampleMatches,
      {
        id: "m3",
        courtNumber: 3,
        team1Names: ["Ian", "Julia"] as [string, string],
        team2Names: ["Kevin", "Laura"] as [string, string],
        team1Score: 11,
        team2Score: 8,
        status: "completed" as const,
        version: 1,
      },
    ];

    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={pickupMatches}
        fieldErrors={{}}
        courtCount={2}
      />
    );

    expect(html).toContain("Court 3");
    expect(html).toContain("Pickup Game");
  });

  it("renders Save All Scores button when hasUnsavedScores and onSaveAllScores are provided", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        hasUnsavedScores={true}
        onSaveAllScores={() => {}}
      />
    );

    expect(html).toContain("Save All Scores");
    expect(html).toContain('data-testid="save-all-scores-button"');
  });
});

