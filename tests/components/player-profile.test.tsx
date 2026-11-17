import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
import { renderToStaticMarkup } from "react-dom/server";
import PlayerProfilePage from "@/app/players/page";
import {
  checkUsernameAvailabilityAction,
  leavePublicGroupAction,
  updatePlayerEmailAction,
  updatePlayerGenderAction,
  updatePlayerPasswordAction,
  updatePlayerProfileAction,
  updatePlayerUsernameAction,
  verifyEmailAction,
} from "@/app/actions/player-account";
import { AccountOptionsMenu, LeaveGroupButton, PlayerProfileHeader, UserSettingsModal } from "@/components/players/player-profile-controls";
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

    // Displays group names
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

  it("renders read-only display name, username, and gender in view mode with centralized Edit Profile button and three-dot menu", async () => {
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

    // Does NOT have individual pencil icons by display name, username, and gender
    expect(html).not.toContain('aria-label="Edit display name"');
    expect(html).not.toContain('aria-label="Edit username"');
    expect(html).not.toContain('aria-label="Edit gender"');

    // Has centralized Edit Profile button and three-dot account options menu
    expect(html).toContain("Edit Profile");
    expect(html).toContain('aria-label="Account options"');

    // Back button removed from page in favor of persistent navigation
    expect(html).not.toContain('aria-label="Go back"');


    // The old display name editor form section is removed
    expect(html).not.toContain('id="profile-name"');
    expect(html).not.toContain('<label for="profile-name"');
  });

  it("PlayerProfileHeader renders display name, username, and gender in view mode without pencil buttons", () => {
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
    expect(html).not.toContain('aria-label="Edit display name"');
    expect(html).not.toContain('aria-label="Edit username"');
    expect(html).not.toContain('aria-label="Edit gender"');
    expect(html).toContain("Edit Profile");
    expect(html).toContain('aria-label="Account options"');
    expect(html).toContain("Advanced Intermediate · current rating 3.75");
  });

  it("AccountOptionsMenu renders three-dot button and dropdown with Settings and Log Out when open", () => {
    const htmlClosed = renderToStaticMarkup(<AccountOptionsMenu initialMenuOpen={false} />);
    expect(htmlClosed).toContain('aria-label="Account options"');
    expect(htmlClosed).not.toContain('data-testid="logout-menu-item"');
    expect(htmlClosed).not.toContain('data-testid="settings-menu-item"');

    const htmlOpen = renderToStaticMarkup(<AccountOptionsMenu initialMenuOpen={true} />);
    expect(htmlOpen).toContain('aria-label="Account options"');
    expect(htmlOpen).toContain('data-testid="settings-menu-item"');
    expect(htmlOpen).toContain("Settings");
    expect(htmlOpen).toContain('data-testid="logout-menu-item"');
    expect(htmlOpen).toContain("Log Out");
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

  it("PlayerProfileHeader does not render Custom Controls badge when portion privacy is customized", () => {
    const html = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Custom User"
        initialUsername="custom_user"
        initialGender="female"
        initialIsPublic={true}
        initialVisibilitySettings={{
          profile: "everyone",
          activities: "only_you",
          ratingStats: "group_members",
          chemistry: "only_you",
          groups: "everyone",
        }}
      />
    );

    expect(html).not.toContain("Custom Controls");
    expect(html).not.toContain('data-testid="custom-visibility-badge"');
  });

  it("PlayerProfileHeader does not render Custom Controls badge when all portions are public default", () => {
    const html = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Default User"
        initialUsername="default_user"
        initialGender="male"
        initialIsPublic={true}
      />
    );

    expect(html).not.toContain("Custom Controls");
    expect(html).not.toContain('data-testid="custom-visibility-badge"');
  });

  it("renders PlayerProfilePage with customized visibility settings gracefully", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "strava_user",
          name: "Strava User",
          passwordHash: "hash",
          skillLevel: "advanced",
          initialRating: 1200,
          visibilitySettings: {
            profile: "everyone",
            activities: "only_you",
            ratingStats: "group_members",
            chemistry: "only_you",
            groups: "everyone",
          },
          createdAt: new Date(),
        },
      ],
      groups: [],
      players: [],
    });
    setActionRepository(repository);

    const pageElement = await PlayerProfilePage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain("Strava User");
    expect(html).toContain("@strava_user");
    expect(html).not.toContain("Custom Controls");
  });

  it("PlayerProfileHeader in edit mode renders 'General Information' section label for name, username, and gender", () => {
    const html = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Test Player"
        initialUsername="test_player"
        initialGender="male"
        initialIsPublic={true}
        initialEditing={true}
      />
    );

    // Header label is "General Information", not "Editing Profile"
    expect(html).toContain("General Information");
    expect(html).not.toContain("Editing Profile");

    // Inputs for Display Name, Username, and Gender
    expect(html).toContain('id="profile-name-input"');
    expect(html).toContain('id="profile-username-input"');
    expect(html).toContain('id="profile-gender-input"');

    // In-page privacy controls are moved to User Settings Modal
    expect(html).not.toContain('data-testid="privacy-controls-section"');
  });

  it("UserSettingsModal renders tabbable categories: Account & Security and Privacy", () => {
    const html = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="account"
      />
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-testid="tab-account"');
    expect(html).toContain('data-testid="tab-privacy"');
    expect(html).toContain("Account &amp; Security");
    expect(html).toContain("Privacy");
  });

  it("UserSettingsModal Account tab renders email update section with verification status and password update with current, new, and confirm inputs", () => {
    const htmlUnverified = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="account"
        initialEmail="athlete@example.com"
        initialEmailVerified={false}
        hasPassword={true}
      />
    );

    // Email section with unverified badge and disabled save when unchanged
    expect(htmlUnverified).toContain("Email Address");
    expect(htmlUnverified).toContain("athlete@example.com");
    expect(htmlUnverified).toContain('data-testid="email-unverified-badge"');
    expect(htmlUnverified).toContain("Unverified · Re-verification Required");
    expect(htmlUnverified).toContain('data-testid="settings-email-input"');
    expect(htmlUnverified).toMatch(/<button[^>]*disabled=""[^>]*data-testid="save-email-button"/);

    // Password section with current, new, and confirm and disabled save when unchanged
    expect(htmlUnverified).toContain("Password");
    expect(htmlUnverified).toContain('data-testid="settings-current-password"');
    expect(htmlUnverified).toContain('data-testid="settings-new-password"');
    expect(htmlUnverified).toContain('data-testid="settings-confirm-password"');
    expect(htmlUnverified).toMatch(/<button[^>]*disabled=""[^>]*data-testid="save-password-button"/);

    // When verified
    const htmlVerified = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="account"
        initialEmail="athlete@example.com"
        initialEmailVerified={true}
        hasPassword={true}
      />
    );
    expect(htmlVerified).toContain('data-testid="email-verified-badge"');
    expect(htmlVerified).toContain("Verified");
  });

  it("UserSettingsModal Privacy tab renders collapsible Privacy Controls drawers and disables save button when unchanged", () => {
    const htmlClosed = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="privacy"
        initialOpenDrawers={{}}
      />
    );

    expect(htmlClosed).toContain("Privacy Controls");
    expect(htmlClosed).toContain('data-testid="toggle-drawer-profile"');
    expect(htmlClosed).toContain('data-testid="toggle-drawer-activities"');
    expect(htmlClosed).toContain('data-testid="toggle-drawer-ratingStats"');
    expect(htmlClosed).toContain('data-testid="toggle-drawer-chemistry"');
    expect(htmlClosed).toContain('data-testid="toggle-drawer-groups"');
    // Save Privacy Settings is disabled when no changes made
    expect(htmlClosed).toMatch(/<button[^>]*disabled=""[^>]*data-testid="save-privacy-settings-button"/);

    // Drawers are closed
    expect(htmlClosed).not.toContain('data-testid="profile-visibility-everyone"');

    // Drawer open view
    const htmlOpen = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="privacy"
        initialOpenDrawers={{ profile: true }}
      />
    );

    expect(htmlOpen).toContain('data-testid="profile-visibility-everyone"');
    expect(htmlOpen).toContain('data-testid="profile-visibility-group_members"');
    expect(htmlOpen).toContain('data-testid="profile-visibility-only_you"');
    expect(htmlOpen).toContain("Anyone can search for your profile and view your profile page.");
    expect(htmlOpen).toContain("bg-[#ccff00]");
  });

  it("PlayerProfileHeader renders Group Members badge when profile page visibility is group_members", () => {
    const html = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Group Player"
        initialUsername="group_player"
        initialGender="female"
        initialIsPublic={true}
        initialVisibilitySettings={{
          profile: "group_members",
          activities: "group_members",
          ratingStats: "group_members",
          chemistry: "group_members",
          groups: "group_members",
        }}
      />
    );

    expect(html).toContain("Group Members Only");
    expect(html).not.toContain("Custom Controls");
    expect(html).not.toContain('data-testid="custom-visibility-badge"');
  });

  it("enforces visibility ceiling in UserSettingsModal: disables options exceeding Profile Page ceiling", () => {
    // When profile is group_members and activities drawer is open
    const htmlGroupCeiling = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="privacy"
        initialVisibilitySettings={{
          profile: "group_members",
          activities: "group_members",
          ratingStats: "group_members",
          chemistry: "group_members",
          groups: "group_members",
        }}
        initialOpenDrawers={{ activities: true }}
      />
    );

    // In activities drawer, "everyone" option is disabled
    expect(htmlGroupCeiling).toMatch(/<button[^>]*disabled=""[^>]*data-testid="activities-visibility-everyone"/);
    expect(htmlGroupCeiling).toContain("Visibility ceiling: Group Members (from Profile Page)");

    // When profile is only_you and activities drawer is open
    const htmlPrivateCeiling = renderToStaticMarkup(
      <UserSettingsModal
        isOpen={true}
        onClose={() => {}}
        initialTab="privacy"
        initialVisibilitySettings={{
          profile: "only_you",
          activities: "only_you",
          ratingStats: "only_you",
          chemistry: "only_you",
          groups: "only_you",
        }}
        initialOpenDrawers={{ activities: true }}
      />
    );

    // In activities drawer, both "everyone" and "group_members" are disabled
    expect(htmlPrivateCeiling).toMatch(/<button[^>]*disabled=""[^>]*data-testid="activities-visibility-everyone"/);
    expect(htmlPrivateCeiling).toMatch(/<button[^>]*disabled=""[^>]*data-testid="activities-visibility-group_members"/);
    expect(htmlPrivateCeiling).toContain("Visibility ceiling: Only You (from Profile Page)");
  });

  it("updatePlayerEmailAction updates player email address and rejects duplicates", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "main_user",
          name: "Main User",
          email: "old@example.com",
          emailVerified: true,
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: "usr_other",
          username: "other_user",
          name: "Other User",
          email: "taken@example.com",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    // Rejects invalid email
    const invalidRes = await updatePlayerEmailAction({ email: "not-an-email" });
    expect(invalidRes.ok).toBe(false);

    // Rejects taken email
    const takenRes = await updatePlayerEmailAction({ email: "taken@example.com" });
    expect(takenRes.ok).toBe(false);
    expect(takenRes).toMatchObject({ ok: false, error: "That email is already registered to another account." });

    // Rejects identical email
    const sameRes = await updatePlayerEmailAction({ email: "old@example.com" });
    expect(sameRes.ok).toBe(false);
    expect(sameRes).toMatchObject({ ok: false, error: "New email address must be different from current email address." });

    // Successfully updates email
    const successRes = await updatePlayerEmailAction({ email: "new_email@example.com" });
    expect(successRes.ok).toBe(true);

    const updated = await repository.getPlayerAccount(testAccountId);
    expect(updated?.email).toBe("new_email@example.com");
    // Email verification must be reset to false (re-verification required)
    expect(updated?.emailVerified).toBe(false);

    // Verification token was generated
    expect(repository.state.emailVerificationTokens.length).toBe(1);
    expect(repository.state.emailVerificationTokens[0].email).toBe("new_email@example.com");

    // verifyEmailAction verifies the token, restores verified status, and removes the token
    if (successRes.ok && successRes.data.verificationToken) {
      const verifyRes = await verifyEmailAction({ token: successRes.data.verificationToken });
      expect(verifyRes.ok).toBe(true);
      const verifiedAcc = await repository.getPlayerAccount(testAccountId);
      expect(verifiedAcc?.emailVerified).toBe(true);
      expect(repository.state.emailVerificationTokens.length).toBe(0);
    }
  });

  it("PlayerProfileHeader disables Save Changes button when in edit mode and no fields have been modified", () => {
    const htmlUnchanged = renderToStaticMarkup(
      <PlayerProfileHeader
        initialName="Jane Doe"
        initialUsername="janedoe"
        initialGender="female"
        initialEditing={true}
      />
    );
    expect(htmlUnchanged).toMatch(/<button[^>]*disabled=""[^>]*data-testid="save-profile-button"/);
  });

  it("updatePlayerPasswordAction verifies current password and enforces new password requirements", async () => {
    const initialHash = await hash("old-password-123", 12);
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: testAccountId,
          username: "pass_user",
          name: "Password User",
          passwordHash: initialHash,
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
    });
    setActionRepository(repository);

    // Rejects when new passwords don't match
    const mismatchRes = await updatePlayerPasswordAction({
      currentPassword: "old-password-123",
      newPassword: "new-super-password-123",
      confirmPassword: "different-password-123",
    });
    expect(mismatchRes.ok).toBe(false);

    // Rejects when new password is too short
    const shortRes = await updatePlayerPasswordAction({
      currentPassword: "old-password-123",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(shortRes.ok).toBe(false);

    // Rejects when current password is wrong
    const wrongCurrentRes = await updatePlayerPasswordAction({
      currentPassword: "wrong-current-password",
      newPassword: "new-super-password-123",
      confirmPassword: "new-super-password-123",
    });
    expect(wrongCurrentRes.ok).toBe(false);
    expect(wrongCurrentRes).toMatchObject({ ok: false, error: "Current password is incorrect." });

    // Successfully updates password
    const successRes = await updatePlayerPasswordAction({
      currentPassword: "old-password-123",
      newPassword: "new-super-password-123",
      confirmPassword: "new-super-password-123",
    });
    expect(successRes.ok).toBe(true);

    const updated = await repository.getPlayerAccount(testAccountId);
    expect(updated?.passwordHash).not.toBe(initialHash);
  });
});



