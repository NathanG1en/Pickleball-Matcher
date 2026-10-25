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
import { TeamTournamentCreationForm } from "@/components/tournaments/team-tournament-creation-form";
import { TeamTournamentManager } from "@/components/tournaments/team-tournament-manager";
import { NewTournamentClient } from "@/components/tournaments/new-tournament-client";
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
      expect(html).toContain("Female");
      expect(html).toContain("Male");
      expect(html).not.toContain("Assign player gender");
      expect(html).not.toContain("No Gender");

      // Add guest form
      expect(html).toContain("Add guest player name...");
      expect(html).toContain("Guest Starting Rating");

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

      expect(html).toContain("← Back to Group");
      expect(html).toContain("Spring Open");
      expect(html).toContain("Active Tournament");
      expect(html).toContain("Mark Finished");
      expect(html).not.toContain("Reopen");
      expect(html).toContain("Men&#x27;s Singles");
      expect(html).toContain("Finals");
      expect(html).toContain("Bob");
      expect(html).toContain("Charlie");
      expect(html).not.toContain(">Win<");
      expect(html).toContain("Reshuffle Matchups");
      expect(html).toContain("Edit");
      expect(html).toContain("tournament-options-menu-button");
      expect(html).toContain("···");
      expect(html).toContain('aria-label="Edit tournament name"');
      expect(html).toContain("score1-input-mens_singles_r1_m1");
      expect(html).toContain("score2-input-mens_singles_r1_m1");
      expect(html).toContain("save-score-mens_singles_r1_m1");
      expect(html).toContain("Save");

      const memberHtml = renderToStaticMarkup(
        <TournamentBracketManager
          initialTournament={tournament}
          isOrganizer={false}
        />
      );
      expect(memberHtml).not.toContain("tournament-options-menu-button");
      expect(memberHtml).not.toContain("Mark Finished");
      expect(memberHtml).not.toContain('aria-label="Edit tournament name"');
      expect(memberHtml).not.toContain("score1-input-mens_singles_r1_m1");
      expect(memberHtml).not.toContain("Save");
    });

    it("renders completed tournament with Completed badge and no raw reopen link", () => {
      const tournament: TournamentRecord = {
        id: "tr_1",
        groupId: "g1",
        name: "Spring Open",
        status: "completed",
        divisions: ["mens_singles"],
        brackets: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const html = renderToStaticMarkup(
        <TournamentBracketManager
          initialTournament={tournament}
          isOrganizer={true}
        />
      );

      expect(html).toContain("Completed");
      expect(html).not.toContain("Active Tournament");
      expect(html).not.toContain("Mark Finished");
      expect(html).not.toContain("Reopen");
      expect(html).toContain("tournament-options-menu-button");
    });

    it("renders winner in vibrant green with scores when match is completed", () => {
      const bMens = generateBracket(
        "mens_singles",
        [
          { id: "p2", name: "Bob", playerIds: ["p2"] },
          { id: "p3", name: "Charlie", playerIds: ["p3"] },
        ],
        { randomize: false }
      );
      bMens.matches[0]!.winnerId = "p2";
      bMens.matches[0]!.score1 = 11;
      bMens.matches[0]!.score2 = 8;
      bMens.matches[0]!.status = "completed";

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

      // Winner Bob is highlighted in green
      expect(html).toContain("bg-[#ccff00]");
      expect(html).toContain("Men&#x27;s Singles Champion");
      expect(html).toContain("Bob");
      expect(html).toContain("Reset Winner");
    });

    it("renders 'Skipped' instead of 'BYE' when a match has a bye", () => {
      const bMens = generateBracket(
        "mens_singles",
        [
          { id: "p1", name: "Alice", playerIds: ["p1"] },
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

      expect(html).toContain("Skipped");
      expect(html).not.toContain(">BYE<");
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

    it("renders team tournament with dedicated badge and manage bracket button", () => {
      const tournament: TournamentRecord = {
        id: "tr_team_1",
        groupId: "g1",
        name: "Spring Team Battle",
        status: "active",
        format: "team_dual",
        divisions: [],
        brackets: {},
        teamData: {
          pairs: [],
          teams: [
            { id: "t1", name: "Team Fire 🔥", color: "#ef4444", pairIds: [], soloPlayerIds: [] },
            { id: "t2", name: "Team Ice ❄️", color: "#3b82f6", pairIds: [], soloPlayerIds: [] },
          ],
          lines: [],
          format: "dual_meet",
          scoringType: "games_won",
        },
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

      expect(html).toContain("Spring Team Battle");
      expect(html).toContain("Team Tournament");
      expect(html).toContain("Manage Bracket →");
    });
  });

  describe("NewTournamentClient", () => {
    it("renders format selector with Division Brackets and Team Tournament options", () => {
      const html = renderToStaticMarkup(
        <NewTournamentClient
          groupId="g1"
          groupName="Pickle Masters"
          initialPlayers={samplePlayers}
        />
      );

      expect(html).toContain("Choose Tournament Format");
      expect(html).toContain("Division Brackets");
      expect(html).toContain("Select Division Brackets →");
      expect(html).toContain("Team Tournament");
      expect(html).toContain("Select Team Tournament →");
      expect(html).toContain("Pre-formed doubles pairs stay locked on the same team");
    });

    it("renders team tournament creation form when initialFormat is team_dual", () => {
      const html = renderToStaticMarkup(
        <NewTournamentClient
          groupId="g1"
          groupName="Pickle Masters"
          initialPlayers={samplePlayers}
          initialFormat="team_dual"
        />
      );

      expect(html).toContain("Create Team Tournament");
      expect(html).toContain("Team Tournament Details");
      expect(html).toContain("Pre-Formed Doubles Pairs");
      expect(html).toContain("Team Rosters");
      // Exactly one back button ("← Change Format"), no duplicate "← Choose Different Format"
      expect(html).toContain("← Change Format");
      expect(html).not.toContain("← Choose Different Format");
    });
  });

  describe("TeamTournamentCreationForm", () => {
    it("renders doubles pairing controls, attendance roster, and team auto-balance", () => {
      const html = renderToStaticMarkup(
        <TeamTournamentCreationForm
          groupId="g1"
          groupName="Pickle Masters"
          initialPlayers={samplePlayers}
        />
      );

      expect(html).toContain("Team Tournament Details");
      expect(html).toContain("Pickle Masters Team Clash");
      expect(html).toContain("Who is Playing Today?");
      expect(html).toContain("4 players selected");
      expect(html).toContain("Remove Alice from selection");
      expect(html).toContain("✕");
      expect(html).toContain("Pre-Formed Doubles Pairs");
      expect(html).toContain("Link Two Players as Doubles Partners");
      expect(html).toContain("Lock Partner Pair");
      expect(html).toContain("Team Rosters");
      expect(html).toContain("Auto-Balance Teams");
      expect(html).toContain("Create Team Tournament →");
    });
  });

  describe("TeamTournamentManager", () => {
    it("renders team scoreboard, match lines, and line status", () => {
      const tournament: TournamentRecord = {
        id: "tr_team_1",
        groupId: "g1",
        name: "Spring Team Battle",
        status: "active",
        format: "team_dual",
        divisions: [],
        brackets: {},
        teamData: {
          pairs: [
            { id: "pair_1", player1Id: "p1", player2Id: "p2" },
            { id: "pair_2", player1Id: "p3", player2Id: "p4" },
          ],
          teams: [
            { id: "team_1", name: "Team Fire 🔥", color: "#ef4444", pairIds: ["pair_1"], soloPlayerIds: [] },
            { id: "team_2", name: "Team Ice ❄️", color: "#3b82f6", pairIds: ["pair_2"], soloPlayerIds: [] },
          ],
          lines: [
            {
              id: "line_1",
              lineNumber: 1,
              name: "Line 1 - Doubles",
              type: "doubles",
              team1PlayerIds: ["p1", "p2"],
              team2PlayerIds: ["p3", "p4"],
              team1Score: 11,
              team2Score: 9,
              status: "completed",
            },
            {
              id: "line_2",
              lineNumber: 2,
              name: "Line 2 - Singles",
              type: "singles",
              team1PlayerIds: ["p1"],
              team2PlayerIds: ["p3"],
              team1Score: null,
              team2Score: null,
              status: "pending",
            },
          ],
          format: "dual_meet",
          scoringType: "games_won",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const html = renderToStaticMarkup(
        <TeamTournamentManager
          initialTournament={tournament}
          isOrganizer={true}
          players={samplePlayers}
        />
      );

      expect(html).toContain("Spring Team Battle");
      expect(html).toContain("Active");
      expect(html).not.toContain("Team Tournament");
      expect(html).toContain("Finish Tournament");
      expect(html).not.toContain("Reopen Clash");
      expect(html).toContain("Team Fire 🔥");
      expect(html).toContain("Team Ice ❄️");
      expect(html).toContain("Match Lines &amp; Courts");
      expect(html).toContain("Line 1 - Doubles");
      expect(html).toContain("Alice &amp; Bob");
      expect(html).toContain("Charlie &amp; Dana");
      expect(html).toContain("Final");
      expect(html).toContain("+ Add Deciding Line");
      expect(html).toContain('aria-label="Edit tournament name"');
      expect(html).toContain("tournament-options-menu-button");
      expect(html).toContain("···");

      const memberHtml = renderToStaticMarkup(
        <TeamTournamentManager
          initialTournament={tournament}
          isOrganizer={false}
          players={samplePlayers}
        />
      );
      expect(memberHtml).not.toContain('aria-label="Edit tournament name"');
      expect(memberHtml).not.toContain("tournament-options-menu-button");
      expect(memberHtml).not.toContain("Finish Tournament");
    });

    it("renders completed team clash with Completed badge and no raw reopen button", () => {
      const tournament: TournamentRecord = {
        id: "tr_team_1",
        groupId: "g1",
        name: "Spring Team Battle",
        status: "completed",
        format: "team_dual",
        divisions: [],
        brackets: {},
        teamData: {
          pairs: [],
          teams: [
            { id: "team_1", name: "Team Fire 🔥", color: "#ef4444", pairIds: [], soloPlayerIds: [] },
            { id: "team_2", name: "Team Ice ❄️", color: "#3b82f6", pairIds: [], soloPlayerIds: [] },
          ],
          lines: [],
          format: "dual_meet",
          scoringType: "games_won",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const html = renderToStaticMarkup(
        <TeamTournamentManager
          initialTournament={tournament}
          isOrganizer={true}
          players={samplePlayers}
        />
      );

      expect(html).toContain("Completed");
      expect(html).not.toContain("Finish Tournament");
      expect(html).not.toContain("Reopen Clash");
      expect(html).toContain("tournament-options-menu-button");
    });
  });
});
