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
        onSaveAndStartNextRound={() => {}}
      />
    );

    expect(html).toContain("mobile-action-bar");
    expect(html).toContain("Save &amp; Start R2");
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

    expect(html).toContain("Save All");
    const button = html.match(/<button[^>]*data-testid="save-all-scores-button"[^>]*>/)?.[0] ?? "";
    expect(button).not.toMatch(/\sdisabled([=>\s])/);
  });

  it("disables Save All Scores button when there are no new scores", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        hasUnsavedScores={false}
        onSaveAllScores={() => {}}
      />
    );

    expect(html).toContain("Save All");
    const button = html.match(/<button[^>]*data-testid="save-all-scores-button"[^>]*>/)?.[0] ?? "";
    expect(button).toMatch(/\sdisabled([=>\s])/);
  });

  it("disables match card Update Score button when completed score is unchanged", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        onSubmitResult={() => {}}
      />
    );

    // Court 1 (m1) is completed with 11-9 and unchanged, so Update Score is disabled
    expect(html).toContain("Update Score");
    const button = html.match(/<button[^>]*>Update Score<\/button>/)?.[0] ?? "";
    expect(button).toMatch(/\sdisabled([=>\s])/);
  });

  it("enables Save & Start button when all matches are completed even if already saved", () => {
    // sampleMatches has completed m1 and cancelled m2, but hasUnsavedScores is false
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        hasUnsavedScores={false}
        onSaveAndStartNextRound={() => {}}
      />
    );

    expect(html).toContain('data-testid="save-and-start-next-round-button"');
    const button = html.match(/<button[^>]*data-testid="save-and-start-next-round-button"[^>]*>/)?.[0] ?? "";
    expect(button).not.toMatch(/\sdisabled([=>\s])/);
  });

  it.each(["", "11", "-1", "1.5"])("blocks an invalid correction %s before Save & Start", team2 => {
    const html = renderToStaticMarkup(<ResultsEntryView roundId="r1" roundNumber={1} matches={sampleMatches} scoreDrafts={{ m1: { team1: "11", team2 } }} onSaveAndStartNextRound={() => {}} />);
    const button = html.match(/<button[^>]*data-testid="save-and-start-next-round-button"[^>]*>/)?.[0] ?? "";
    expect(button).toMatch(/\sdisabled([=>\s])/);
  });

  it("disables Save & Start button if Start is disabled (pending matches lack scores)", () => {
    const pendingMatches = [
      {
        id: "m1",
        courtNumber: 1,
        team1Names: ["Alice", "Bob"] as [string, string],
        team2Names: ["Charlie", "Diana"] as [string, string],
        team1Score: null,
        team2Score: null,
        status: "pending" as const,
        version: 1,
      },
    ];

    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={pendingMatches}
        fieldErrors={{}}
        hasUnsavedScores={true}
        onSaveAndStartNextRound={() => {}}
      />
    );

    expect(html).toContain('data-testid="save-and-start-next-round-button"');
    const button = html.match(/<button[^>]*data-testid="save-and-start-next-round-button"[^>]*>/)?.[0] ?? "";
    expect(button).toMatch(/\sdisabled([=>\s])/);
  });

  it("enables Save & Start button when both Save (new scores exist) and Start (all matches scored) conditions are met", () => {
    const pendingMatchesWithDrafts = [
      {
        id: "m1",
        courtNumber: 1,
        team1Names: ["Alice", "Bob"] as [string, string],
        team2Names: ["Charlie", "Diana"] as [string, string],
        team1Score: null,
        team2Score: null,
        status: "pending" as const,
        version: 1,
      },
    ];

    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={pendingMatchesWithDrafts}
        scoreDrafts={{ m1: { team1: "11", team2: "9" } }}
        fieldErrors={{}}
        hasUnsavedScores={true}
        onSaveAndStartNextRound={() => {}}
      />
    );

    expect(html).toContain('data-testid="save-and-start-next-round-button"');
    const button = html.match(/<button[^>]*data-testid="save-and-start-next-round-button"[^>]*>/)?.[0] ?? "";
    expect(button).not.toMatch(/\sdisabled([=>\s])/);
  });

  it("renders Up Next Lineup Preview and Save & Start Next Round button when upcomingProposal is provided", () => {
    const upcomingProposal = {
      roundNumber: 2,
      seed: 42,
      score: 100,
      courts: [
        {
          courtNumber: 1,
          team1: ["p1", "p2"] as [string, string],
          team2: ["p3", "p4"] as [string, string],
          matchType: "doubles" as const,
        },
      ],
      sitting: ["p5"],
      scoreBreakdown: {
        playingTime: 0,
        consecutiveSit: 0,
        partnerRepeat: 0,
        skillBalance: 0,
        opponentRepeat: 0,
        tieBreak: 0,
        total: 0,
      },
    };
    const playerNames = {
      p1: "Alice",
      p2: "Bob",
      p3: "Charlie",
      p4: "Diana",
      p5: "Evan",
    };

    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        upcomingProposal={upcomingProposal}
        playerNames={playerNames}
        onSaveAndStartNextRound={() => {}}
      />
    );

    expect(html).toContain("Up Next: Round 2 Lineup Preview");
    expect(html).toContain('data-testid="upcoming-lineup-preview"');
    expect(html).toContain("Alice &amp; Bob");
    expect(html).toContain("Charlie &amp; Diana");
    expect(html).toContain("Evan");
    expect(html).toContain("Save &amp; Start R2");
    expect(html).toContain('data-testid="save-and-start-next-round-button"');
  });

  it("renders only Save All and Save & Start Next Round action buttons without a separate Next Round button", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r3"
        roundNumber={3}
        matches={sampleMatches}
        fieldErrors={{}}
        onSaveAllScores={() => {}}
        onSaveAndStartNextRound={() => {}}
      />
    );

    expect(html).toContain('data-testid="save-all-scores-button"');
    expect(html).toContain('data-testid="save-and-start-next-round-button"');
    expect(html).not.toContain("Start Round 4");
  });

  it("renders Add Game button with single-line whitespace-nowrap and shrink-0 classes to prevent squishing on mobile", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        canManage={true}
        onAddGame={() => {}}
      />
    );

    expect(html).toContain("+ Add Game");
    expect(html).toContain("whitespace-nowrap shrink-0");
    const addGameButton = html.match(/<button[^>]*>[^<]*<span[^>]*>\+ Add Game<\/span><\/button>/)?.[0] ?? "";
    expect(addGameButton).toContain("whitespace-nowrap");
  });

  it("renders Add Game and Reshuffle with matching matchup confirmation pill styling", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        canManage={true}
        onAddGame={() => {}}
        onReshuffleRound={() => {}}
      />
    );

    expect(html).toContain("+ Add Game");
    expect(html).toContain("Reshuffle");
    expect(html).toContain('data-testid="reshuffle-matchups-button"');
    // Both buttons use the matchup confirmation header button styling
    expect(html).toContain("shadow-[3.5px_3.5px_0px_0px_#000]");
    expect(html).toContain("text-[11px] sm:text-xs");
    expect(html).toContain("bg-[#ccff00]");
    expect(html).toContain("bg-white");
  });

  it("does not render matchup confirmation modal when confirmMatchups is false", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        canManage={true}
        onSaveAndStartNextRound={() => {}}
        confirmMatchups={false}
      />
    );

    expect(html).toContain('data-testid="save-and-start-next-round-button"');
    expect(html).not.toContain('data-testid="matchup-confirmation-modal"');
  });

  it("passes confirmMatchups prop cleanly and maintains save-and-start functionality", () => {
    const html = renderToStaticMarkup(
      <ResultsEntryView
        roundId="r1"
        roundNumber={1}
        matches={sampleMatches}
        fieldErrors={{}}
        canManage={true}
        onSaveAndStartNextRound={() => {}}
        confirmMatchups={true}
      />
    );

    expect(html).toContain('data-testid="save-and-start-next-round-button"');
  });
});

