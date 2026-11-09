import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlayerProfilePage from "@/app/players/page";
import {
  checkUsernameAvailabilityAction,
  leavePublicGroupAction,
  updatePlayerGenderAction,
  updatePlayerProfileAction,
  updatePlayerUsernameAction,
} from "@/app/actions/player-account";
import { LeaveGroupButton, PlayerProfileHeader } from "@/components/players/player-profile-controls";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";
import * as actionContext from "@/app/actions/action-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    getActivePlayerAccountId: vi.fn(),
    requirePlayer: vi.fn(),
  };
});

describe("PlayerProfilePage and Group Leaving", () => {
  const testAccountId = "usr_test123";

  beforeEach(() => {
    vi.mocked(actionContext.getActivePlayerAccountId).mockResolvedValue(testAccountId);
    vi.mocked(actionContext.requirePlayer).mockResolvedValue(testAccountId);
  });

  afterEach(() => {
    setActionRepository(null);
    vi.clearAllMocks();
  });

  it("renders groups with a link and chevron and does not render host label or leave option", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "host_user",
          name: "Host User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        {
          id: "grp_hosted",
          name: "Hosted League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: testAccountId,
        },
        {
          id: "grp_member",
          name: "Regular League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "usr_other",
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "grp_hosted",
          accountId: testAccountId,
          name: "Host User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
        {
          id: "p2",
          groupId: "grp_member",
          accountId: testAccountId,
          name: "Host User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    // Should display back button and group names
    expect(html).toContain("← Back");
    expect(html).toContain("Hosted League");
    expect(html).toContain("Regular League");

    // Must not show "Host" label or "Leave" option on profile page
    expect(html).not.toContain(">Host<");
    expect(html).not.toContain("Leave");

    // Both groups have a chevron link pointing to the group
    expect(html).toContain('href="/g/grp_hosted"');
    expect(html).toContain('href="/g/grp_member"');
    expect(html).toContain('aria-label="Go to Hosted League"');
    expect(html).toContain('aria-label="Go to Regular League"');
  });

  it("does not render organizer label or leave option on the profile page", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "org_user",
          name: "Org User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        {
          id: "grp_org",
          name: "Co-Organized League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "usr_actual_host",
        },
      ],
      groupOrganizers: [
        {
          groupId: "grp_org",
          accountId: testAccountId,
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "grp_org",
          accountId: testAccountId,
          name: "Org User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    const listItems = html.split("<li").filter((item) => item.includes("Co-Organized League"));
    expect(listItems).toHaveLength(1);

    const orgItem = listItems[0];
    expect(orgItem).not.toContain("Organizer");
    expect(orgItem).not.toContain("Host");
    expect(orgItem).not.toContain("Leave");
    expect(orgItem).toContain('href="/g/grp_org"');
    expect(orgItem).toContain('aria-label="Go to Co-Organized League"');
  });

  it("rejects leavePublicGroupAction when called by the host of the group", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        {
          id: "grp_hosted",
          name: "Hosted League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: testAccountId,
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "grp_hosted",
          accountId: testAccountId,
          name: "Host User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const result = await leavePublicGroupAction({ groupId: "grp_hosted" });
    expect(result).toEqual({ ok: false, error: "Hosts cannot leave their own group." });
  });

  it("allows leavePublicGroupAction when called by a non-host member", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        {
          id: "grp_member",
          name: "Regular League",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: "usr_other",
        },
      ],
      players: [
        {
          id: "p2",
          groupId: "grp_member",
          accountId: testAccountId,
          name: "Member User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const result = await leavePublicGroupAction({ groupId: "grp_member" });
    expect(result).toEqual({ ok: true, data: { groupId: "grp_member" } });
  });

  it("renders pencil icons beside display name, username, and gender and removes old display name editor section", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "active_user",
          name: "Active User",
          gender: "female",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    // Displays name and username and gender
    expect(html).toContain("Active User");
    expect(html).toContain("@active_user");
    expect(html).toContain("Female");

    // Has pencil icons by display name, username, and gender
    expect(html).toContain('aria-label="Edit display name"');
    expect(html).toContain('aria-label="Edit username"');
    expect(html).toContain('aria-label="Edit gender"');

    // Has back button
    expect(html).toContain('aria-label="Go back"');
    expect(html).toContain("← Back");

    // The old display name editor form section is removed
    expect(html).not.toContain('id="profile-name"');
    expect(html).not.toContain('<label for="profile-name"');
  });

  it("PlayerProfileHeader renders display name, username, and gender with pencil buttons", () => {
    const html = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Jane Doe"
        initialUsername="janedoe"
        initialGender="male"
        skillLevel="advanced"
        initialRating={1100}
      />
    );

    expect(html).toContain("Jane Doe");
    expect(html).toContain("@janedoe");
    expect(html).toContain("Male");
    expect(html).toContain('aria-label="Edit display name"');
    expect(html).toContain('aria-label="Edit username"');
    expect(html).toContain('aria-label="Edit gender"');
    expect(html).toContain("Advanced Intermediate · current rating 3.75");
  });

  it("renders the player's current rating on their profile instead of their initial rating", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "ranked_user",
          name: "Ranked Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          rating: 1100,
          ratedGamesPlayed: 5,
          createdAt: new Date(),
        },
      ],
      groups: [],
      players: [],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain("Ranked Player");
    expect(html).toContain("Advanced Intermediate · current rating 3.75");
    expect(html).not.toContain("current rating 3.5");
    expect(html).not.toContain("starting rating");
  });

  it("corrects the rating description to match current rating (e.g. Advanced Intermediate for 3.5, Intermediate for 3.0)", async () => {
    const intermediateRepo = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "int_user",
          name: "Intermediate Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          rating: 800, // 3.0 DUPR = Intermediate
          ratedGamesPlayed: 3,
          createdAt: new Date(),
        },
      ],
      groups: [],
      players: [],
    });
    setActionRepository(intermediateRepo);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain("Intermediate · current rating 3");
    expect(html).not.toContain("Advanced Intermediate");
  });

  it("checks username availability against database (identifies taken usernames and permits current user)", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "My User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: "usr_other",
          username: "taken_user",
          name: "Other Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    // Another player's username -> unavailable (taken)
    const takenResult = await checkUsernameAvailabilityAction("taken_user");
    expect(takenResult).toEqual({ available: false });

    // With leading @ and mixed case -> still matches exactly in database -> unavailable
    const takenResultWithAt = await checkUsernameAvailabilityAction("@TAKEN_USER");
    expect(takenResultWithAt).toEqual({ available: false });

    // Current player's own username -> available (not taken by someone else)
    const ownResult = await checkUsernameAvailabilityAction("my_user");
    expect(ownResult).toEqual({ available: true });

    // Brand new username -> available
    const freshResult = await checkUsernameAvailabilityAction("brand_new_user");
    expect(freshResult).toEqual({ available: true });
  });

  it("allows updating username when available and rejects taken usernames", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "My User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: "usr_other",
          username: "existing_user",
          name: "Other Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    // Reject taken username
    const failResult = await updatePlayerUsernameAction({ username: "existing_user" });
    expect(failResult).toEqual({ ok: false, error: "That username is already taken." });

    // Reject invalid username (too short)
    const invalidResult = await updatePlayerUsernameAction({ username: "ab" });
    expect(invalidResult).toEqual({ ok: false, error: "Username must be 3 to 24 letters, numbers, or underscores." });

    // Accept valid and available username
    const successResult = await updatePlayerUsernameAction({ username: "cool_new_username" });
    expect(successResult).toEqual({ ok: true, data: { username: "cool_new_username" } });

    // Verify database was updated
    const updatedAccount = await repository.getPlayerAccount(testAccountId);
    expect(updatedAccount?.username).toBe("cool_new_username");
  });

  it("allows updating display name without requiring uniqueness", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "My User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: "usr_other",
          username: "other_user",
          name: "Duplicate Name",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    // Updating display name to match another user's display name succeeds
    const result = await updatePlayerProfileAction({ name: "Duplicate Name" });
    expect(result).toEqual({ ok: true, data: undefined });

    const updatedAccount = await repository.getPlayerAccount(testAccountId);
    expect(updatedAccount?.name).toBe("Duplicate Name");
  });

  it("does not save display name to the database if it is unchanged", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "Current Name",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const updateSpy = vi.spyOn(repository, "updatePlayerAccountName");

    const result = await updatePlayerProfileAction({ name: "Current Name" });
    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("allows updating gender to male or female and updates the repository", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "My User",
          gender: "male",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const result = await updatePlayerGenderAction({ gender: "female" });
    expect(result).toEqual({ ok: true, data: { gender: "female" } });

    const updatedAccount = await repository.getPlayerAccount(testAccountId);
    expect(updatedAccount?.gender).toBe("female");
  });

  it("does not save gender to the database if it is unchanged", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "My User",
          gender: "female",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const updateSpy = vi.spyOn(repository, "updatePlayerAccountGender");

    const result = await updatePlayerGenderAction({ gender: "female" });
    expect(result).toEqual({ ok: true, data: { gender: "female" } });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects updating to an invalid gender", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "my_user",
          name: "My User",
          gender: "male",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    const result = await updatePlayerGenderAction({ gender: "other" });
    expect(result).toEqual({ ok: false, error: "Select a valid gender." });
  });

  it("LeaveGroupButton initially renders Leave button and not modal dialog", () => {
    const html = renderToStaticMarkup(<LeaveGroupButton groupId="grp_test" groupName="Test Group" />);
    expect(html).toContain(">Leave<");
    expect(html).not.toContain('role="alertdialog"');
    expect(html).not.toContain("Cancel");
  });

  it("LeaveGroupButton renders confirmation modal dialog when confirming", () => {
    const html = renderToStaticMarkup(<LeaveGroupButton groupId="grp_test" groupName="Test Group" initialConfirming={true} />);
    expect(html).toContain(">Leave<");
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Leave Group");
    expect(html).toContain('Are you sure you want to leave &quot;Test Group&quot;?');
    expect(html).toContain("Cancel");
    expect(html).toContain('data-testid="confirm-leave-group-button"');
  });

  it("renders a single unified rating over time section across sessions in multiple groups", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "chart_user",
          name: "Chart User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          rating: 1050,
          ratedGamesPlayed: 4,
          createdAt: new Date(),
        },
      ],
      groups: [
        { id: "grp-1", name: "Group One", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
        { id: "grp-2", name: "Group Two", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
      ],
      players: [
        { id: "p1", groupId: "grp-1", accountId: testAccountId, name: "Chart User", initialRating: 1000, rating: 1050, ratedGamesPlayed: 4, active: true },
        { id: "p2", groupId: "grp-2", accountId: testAccountId, name: "Chart User", initialRating: 1000, rating: 1050, ratedGamesPlayed: 4, active: true },
      ],
    });
    repository.state.sessions.push(
      { id: "s1", groupId: "grp-1", courtCount: 1, status: "completed", currentRoundNumber: 1, startedAt: new Date("2026-10-01T10:00:00Z"), endedAt: new Date("2026-10-01T11:00:00Z"), version: 1 },
      { id: "s2", groupId: "grp-2", courtCount: 1, status: "completed", currentRoundNumber: 1, startedAt: new Date("2026-10-02T10:00:00Z"), endedAt: new Date("2026-10-02T11:00:00Z"), version: 1 },
    );
    repository.state.attendance.push(
      { sessionId: "s1", playerId: "p1", joinedRound: 1, leftRound: null },
      { sessionId: "s2", playerId: "p2", joinedRound: 1, leftRound: null },
    );
    repository.state.rounds.push(
      { id: "r1", sessionId: "s1", roundNumber: 1, status: "completed", seed: 1, scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 }, createdAt: new Date(), startedAt: new Date(), completedAt: new Date(), version: 1 },
      { id: "r2", sessionId: "s2", roundNumber: 1, status: "completed", seed: 1, scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 }, createdAt: new Date(), startedAt: new Date(), completedAt: new Date(), version: 1 },
    );
    repository.state.matches.push(
      { id: "m1", roundId: "r1", courtNumber: 1, status: "completed", team1Score: 11, team2Score: 7, completedAt: new Date(), version: 1 },
      { id: "m2", roundId: "r2", courtNumber: 1, status: "completed", team1Score: 11, team2Score: 9, completedAt: new Date(), version: 1 },
    );
    repository.state.matchPlayers.push(
      { matchId: "m1", playerId: "p1", team: 1, ratingBefore: 1000, ratingAfter: 1025 },
      { matchId: "m2", playerId: "p2", team: 1, ratingBefore: 1025, ratingAfter: 1050 },
    );
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    const occurrences = html.split("Rating over time").length - 1;
    expect(occurrences).toBe(1);
    expect(html).not.toContain("Rating over time —");
  });

  it("lists open play sessions as Open Play with links and session info", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "openplay_user",
          name: "OpenPlay User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        { id: "grp-1", name: "Metro Club", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
      ],
      players: [
        { id: "p1", groupId: "grp-1", accountId: testAccountId, name: "OpenPlay User", initialRating: 1000, rating: 1050, ratedGamesPlayed: 2, active: true },
      ],
    });

    repository.state.sessions.push(
      { id: "s-open", groupId: "grp-1", courtCount: 1, status: "completed", currentRoundNumber: 1, startedAt: new Date("2026-10-05T10:00:00Z"), endedAt: new Date("2026-10-05T11:00:00Z"), version: 1, type: "open_play" },
      { id: "s-regular", groupId: "grp-1", courtCount: 1, status: "completed", currentRoundNumber: 1, startedAt: new Date("2026-10-01T10:00:00Z"), endedAt: new Date("2026-10-01T11:00:00Z"), version: 1, type: "regular" },
    );
    repository.state.attendance.push(
      { sessionId: "s-open", playerId: "p1", joinedRound: 1, leftRound: null },
      { sessionId: "s-regular", playerId: "p1", joinedRound: 1, leftRound: null },
    );
    repository.state.rounds.push(
      { id: "r-open", sessionId: "s-open", roundNumber: 1, status: "completed", seed: 1, scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 }, createdAt: new Date(), startedAt: new Date(), completedAt: new Date(), version: 1 },
      { id: "r-regular", sessionId: "s-regular", roundNumber: 1, status: "completed", seed: 1, scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 }, createdAt: new Date(), startedAt: new Date(), completedAt: new Date(), version: 1 },
    );
    repository.state.matches.push(
      { id: "m-open", roundId: "r-open", courtNumber: 1, status: "completed", team1Score: 11, team2Score: 9, completedAt: new Date(), version: 1 },
      { id: "m-regular", roundId: "r-regular", courtNumber: 1, status: "completed", team1Score: 11, team2Score: 5, completedAt: new Date(), version: 1 },
    );
    repository.state.matchPlayers.push(
      { matchId: "m-open", playerId: "p1", team: 1, ratingBefore: 1000, ratingAfter: 1025 },
      { matchId: "m-regular", playerId: "p1", team: 1, ratingBefore: 1025, ratingAfter: 1050 },
    );
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    // Open play session should be listed with (Open Play) next to group name
    expect(html).toContain("Metro Club (Open Play)");
    // Regular session should show group name
    expect(html).toContain("Metro Club");
    // Both should link to their respective sessions with ?from=profile
    expect(html).toContain('href="/g/grp-1/sessions/s-open?from=profile"');
    expect(html).toContain('href="/g/grp-1/sessions/s-regular?from=profile"');
    // Win/loss info should be present
    expect(html).toContain("1W – 0L");
    // Go to session button should be present
    expect(html).toContain("Go to session");
    // Session title should not be a link
    expect(html).not.toMatch(/<h3[^>]*><a/);
  });

  it("includes the date when a player session has a custom name", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "player_named_session",
          name: "Named Session Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        { id: "grp-named", name: "Metro Club", organizerPinHash: "hash", createdAt: new Date(), isPublic: true },
      ],
      players: [
        { id: "p1", groupId: "grp-named", accountId: testAccountId, name: "Named Session Player", initialRating: 1000, rating: 1025, ratedGamesPlayed: 1, active: true },
      ],
    });

    repository.state.sessions.push({
      id: "s-named",
      groupId: "grp-named",
      name: "Spring Kickoff",
      courtCount: 1,
      status: "completed",
      currentRoundNumber: 1,
      startedAt: new Date("2026-04-12T10:00:00Z"),
      endedAt: new Date("2026-04-12T11:00:00Z"),
      version: 1,
      type: "regular",
    });
    repository.state.attendance.push({
      sessionId: "s-named",
      playerId: "p1",
      joinedRound: 1,
      leftRound: null,
    });
    repository.state.rounds.push({
      id: "r-named",
      sessionId: "s-named",
      roundNumber: 1,
      status: "completed",
      seed: 1,
      scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      version: 1,
    });
    repository.state.matches.push({
      id: "m-named",
      roundId: "r-named",
      courtNumber: 1,
      status: "completed",
      team1Score: 11,
      team2Score: 7,
      completedAt: new Date(),
      version: 1,
    });
    repository.state.matchPlayers.push({
      matchId: "m-named",
      playerId: "p1",
      team: 1,
      ratingBefore: 1000,
      ratingAfter: 1025,
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain("Spring Kickoff · ");
    expect(html).toMatch(/<time[^>]*dateTime="2026-04-12T10:00:00.000Z"[^>]*>Apr 12, 2026<\/time>/);
  });

  it("renders profile header, sections, and stat cards without drop shadows while buttons keep shadows", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "shadowtest",
          name: "Shadow Test",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          rating: 1050,
          createdAt: new Date(),
        },
      ],
      groups: [
        {
          id: "g1",
          name: "Shadow Group",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: testAccountId,
        },
      ],
      players: [
        {
          id: "p1",
          groupId: "g1",
          accountId: testAccountId,
          name: "Shadow Test",
          initialRating: 1000,
          rating: 1050,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    // Header and sections should NOT have shadow
    expect(html).not.toContain("shadow-[6px_6px_0px_0px_#000]");
    expect(html).not.toContain("shadow-[5px_5px_0px_0px_#000]");
    expect(html).not.toMatch(/(?<!hover:)shadow-\[3px_3px_0px_0px_#000\]/);
    // Buttons (like Create / Find groups / BackButton) SHOULD have shadow
    expect(html).toContain("shadow-[2px_2px_0px_0px_#000]");
  });

  it("renders sections in order: chemistry spotlight, sessions/wins/losses, groups, then chart and past sessions", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "order_test_user",
          name: "Order User",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groups: [
        { id: "g1", name: "Test League", organizerPinHash: "hash", createdAt: new Date() },
      ],
      players: [
        {
          id: "p1",
          groupId: "g1",
          accountId: testAccountId,
          name: "Order User",
          initialRating: 1000,
          rating: 1000,
          ratedGamesPlayed: 0,
          active: true,
        },
      ],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    const chemistryIndex = html.indexOf("Chemistry Spotlight");
    const sessionsIndex = html.indexOf(">Sessions<");
    const groupsIndex = html.indexOf("My Groups");
    const pastSessionsIndex = html.indexOf("Past Sessions");

    expect(chemistryIndex).toBeGreaterThan(-1);
    expect(sessionsIndex).toBeGreaterThan(chemistryIndex);
    expect(groupsIndex).toBeGreaterThan(sessionsIndex);
    expect(pastSessionsIndex).toBeGreaterThan(groupsIndex);
  });
});


