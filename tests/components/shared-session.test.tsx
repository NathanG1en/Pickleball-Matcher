import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SharedSessionView } from "@/components/rounds/shared-session";

const sampleProps = {
  groupName: "Tuesday Morning Pickleball",
  sessionStatus: "active" as const,
  currentRoundNumber: 2,
  courts: [
    {
      courtNumber: 1,
      team1Names: ["Alice", "Bob"] as [string, string],
      team2Names: ["Charlie", "Diana"] as [string, string],
      team1Score: 11,
      team2Score: 7,
      status: "completed" as const,
    },
    {
      courtNumber: 2,
      team1Names: ["Evan", "Frank"] as [string, string],
      team2Names: ["Grace", "Hank"] as [string, string],
      team1Score: null,
      team2Score: null,
      status: "pending" as const,
    },
  ],
  sittingPlayerNames: ["Ivy", "Jack"],
};

describe("SharedSessionView Component", () => {
  it("renders live courts, scores, and sitting players", () => {
    const html = renderToStaticMarkup(<SharedSessionView {...sampleProps} />);

    expect(html).toContain("Tuesday Morning Pickleball");
    expect(html).toContain("Round 2");
    expect(html).toContain("Court 1");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("11");
    expect(html).toContain("7");
    expect(html).toContain("Court 2");
    expect(html).toContain("Sitting this round");
    expect(html).toContain("Ivy");
    expect(html).toContain("Jack");
  });

  it("does not render any organizer action buttons or controls", () => {
    const html = renderToStaticMarkup(<SharedSessionView {...sampleProps} />);

    expect(html).not.toContain("Start Round");
    expect(html).not.toContain("Enter Scores");
    expect(html).not.toContain("Regenerate");
    expect(html).not.toContain("Cancel match");
    expect(html).not.toContain("End Session");
    expect(html).not.toContain("mobile-action-bar");
  });
});
