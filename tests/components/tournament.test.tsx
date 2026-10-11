import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
}));

import { TournamentCreationForm } from "@/components/tournaments/tournament-creation-form";
import { TournamentBracketManager } from "@/components/tournaments/tournament-bracket-manager";
import { GroupTournamentsList } from "@/components/tournaments/group-tournaments-list";
import type { PlayerRecord, TournamentRecord } from "@/lib/domain/types";
import { generateBracket } from "@/lib/tournament/bracket";

const samplePlayers: PlayerRecord[] = [
  { id: "p1", groupId: "g1", name: "Alice", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "female" },
  { id: "p2", groupId: "g1", name: "Bob", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" },
  { id: "p3", groupId: "g1", name: "Charlie", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "male" },
  { id: "p4", groupId: "g1", name: "Dana", initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true, gender: "female" },
];

describe("Tournament UI Components", () => {
  describe("TournamentCreationForm", () => {
    it("renders tournament details, division options, and player attendance roster", () => {
      const html = renderToStaticMarkup(
        <TournamentCreationForm
          groupId="g1"
          groupName="Pickle Masters"
          initialPlayers={samplePlayers}
        />
      );

      // Details
      expect(html).toContain("Tournament Details");
      expect(html).toContain("Pickle Masters Championship");

      // Division selection options (Mens and Womens Singles and Doubles, and Mixed Doubles)
      expect(html).toContain("Men&#x27;s Singles");
      expect(html).toContain("Women&#x27;s Singles");
      expect(html).toContain("Men&#x27;s Doubles");
      expect(html).toContain("Women&#x27;s Doubles");
      expect(html).toContain("Mixed Doubles");

      // Select All / Clear for divisions
      expect(html).toContain("Select Divisions");
      expect(html).toContain("Select All");
      expect(html).toContain("Clear");

      // Player selection roster
      expect(html).toContain("Who is Playing Today?");
      expect(html).toContain("Alice");
      expect(html).toContain("Bob");
      expect(html).toContain("Charlie");
      expect(html).toContain("Dana");
      expect(html).toContain("4 players selected");

      // Add guest form
      expect(html).toContain("Add guest player name...");

      // Submit action bar
      expect(html).toContain("Create Tournament →");
    });
  });

  describe("TournamentBracketManager", () => {
    it("renders bracket rounds, match slots, and editing controls", () => {
      const bMens = generateBracket(
        "mens_singles",
        [
          { id: "p2", name: "Bob", playerIds: ["p2"] },
          { id: "p3", name: "Charlie", playerIds: ["p3"] },
        ],
        { randomize: false }
      );

      const tournament: TournamentRecord = {
        id: "tr_1",
        groupId: "g1",
        name: "Spring Open",
        status: "active",
        divisions: ["mens_singles"],
        brackets: {
          mens_singles: bMens,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const html = renderToStaticMarkup(
        <TournamentBracketManager
          initialTournament={tournament}
          isOrganizer={true}
        />
      );

      expect(html).toContain("Spring Open");
      expect(html).toContain("Men&#x27;s Singles");
      expect(html).toContain("Finals");
      expect(html).toContain("Bob");
      expect(html).toContain("Charlie");
      expect(html).toContain("Win");
      expect(html).toContain("Reshuffle Matchups");
      expect(html).toContain("Edit");
    });
  });

  describe("GroupTournamentsList", () => {
    it("renders empty state when there are no tournaments", () => {
      const html = renderToStaticMarkup(
        <GroupTournamentsList
          groupId="g1"
          tournaments={[]}
          isOrganizer={true}
        />
      );

      expect(html).toContain("No tournaments created yet");
      expect(html).toContain("Create First Tournament →");
    });

    it("renders tournament items with status badges and division pills", () => {
      const tournament: TournamentRecord = {
        id: "tr_1",
        groupId: "g1",
        name: "Club Invitational",
        status: "active",
        divisions: ["mens_singles", "mixed_doubles"],
        brackets: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const html = renderToStaticMarkup(
        <GroupTournamentsList
          groupId="g1"
          tournaments={[tournament]}
          isOrganizer={true}
        />
      );

      expect(html).toContain("Club Invitational");
      expect(html).toContain("Active");
      expect(html).toContain("Men&#x27;s Singles");
      expect(html).toContain("Mixed Doubles");
      expect(html).toContain("Manage Bracket →");
    });
  });
});
