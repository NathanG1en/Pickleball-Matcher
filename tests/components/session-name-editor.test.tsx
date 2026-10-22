import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionNameEditor } from "@/components/sessions/session-name-editor";
import { updateSessionNameAction } from "@/app/actions/sessions";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

let currentAccountId: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requireOrganizer: vi.fn(async (groupId: string) => {
      if (currentAccountId && (await actual.getActionRepository().isGroupOrganizer(groupId, currentAccountId))) {
        return null;
      }
      throw new Error("Not authorized");
    }),
  };
});

describe("SessionNameEditor and updateSessionNameAction", () => {
  const hostAccountId = "acc_host";
  const orgAccountId = "acc_org";
  const memberAccountId = "acc_member";

  let repository: InMemoryRepositories;

  beforeEach(() => {
    currentAccountId = null;
    repository = new InMemoryRepositories({
      groups: [
        {
          id: "g1",
          name: "Test Group",
          organizerPinHash: "hash",
          createdAt: new Date(),
          isPublic: true,
          ownerAccountId: hostAccountId,
        },
      ],
      sessions: [
        {
          id: "s1",
          groupId: "g1",
          courtCount: 2,
          status: "active",
          currentRoundNumber: 1,
          startedAt: new Date(),
          endedAt: null,
          version: 1,
          type: "regular",
          name: "Original Session Name",
        },
      ],
      playerAccounts: [
        {
          id: hostAccountId,
          username: "host_user",
          name: "Host Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: orgAccountId,
          username: "org_user",
          name: "Organizer Player",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
        {
          id: memberAccountId,
          username: "member_user",
          name: "Regular Member",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1000,
          createdAt: new Date(),
        },
      ],
      groupOrganizers: [
        { groupId: "g1", accountId: orgAccountId },
      ],
    });
    setActionRepository(repository);
  });

  afterEach(() => {
    setActionRepository(null);
    currentAccountId = null;
    vi.clearAllMocks();
  });

  describe("SessionNameEditor component", () => {
    it("renders display name and edit pencil button when canEdit is true", () => {
      const html = renderToStaticMarkup(
        <SessionNameEditor
          groupId="g1"
          sessionId="s1"
          initialName="Original Session Name"
          canEdit={true}
        />
      );

      expect(html).toContain("Original Session Name");
      expect(html).toContain('aria-label="Edit session name"');
      expect(html).toContain("<h1");
    });

    it("renders custom heading level when headingTag is provided", () => {
      const html = renderToStaticMarkup(
        <SessionNameEditor
          groupId="g1"
          sessionId="s1"
          initialName="Original Session Name"
          canEdit={true}
          headingTag="h2"
        />
      );

      expect(html).toContain("Original Session Name");
      expect(html).toContain("<h2");
      expect(html).not.toContain("<h1");
    });

    it("renders display name without pencil button when canEdit is false", () => {
      const html = renderToStaticMarkup(
        <SessionNameEditor
          groupId="g1"
          sessionId="s1"
          initialName="Original Session Name"
          canEdit={false}
        />
      );

      expect(html).toContain("Original Session Name");
      expect(html).not.toContain('aria-label="Edit session name"');
    });

    it("renders descriptive initial names such as Session In Progress or Completed Session", () => {
      const activeHtml = renderToStaticMarkup(
        <SessionNameEditor
          groupId="g1"
          sessionId="s1"
          initialName="Session In Progress"
          canEdit={true}
        />
      );
      expect(activeHtml).toContain("Session In Progress");

      const completedHtml = renderToStaticMarkup(
        <SessionNameEditor
          groupId="g1"
          sessionId="s1"
          initialName="Completed Session"
          canEdit={true}
        />
      );
      expect(completedHtml).toContain("Completed Session");
    });
  });

  describe("updateSessionNameAction", () => {
    it("allows the host to update the session name", async () => {
      currentAccountId = hostAccountId;

      const result = await updateSessionNameAction({
        groupId: "g1",
        sessionId: "s1",
        name: "Host Renamed Session",
      });

      expect(result.ok).toBe(true);
      const session = await repository.getSession("s1");
      expect(session?.name).toBe("Host Renamed Session");
    });

    it("allows a delegated organizer to update the session name", async () => {
      currentAccountId = orgAccountId;

      const result = await updateSessionNameAction({
        groupId: "g1",
        sessionId: "s1",
        name: "Organizer Renamed Session",
      });

      expect(result.ok).toBe(true);
      const session = await repository.getSession("s1");
      expect(session?.name).toBe("Organizer Renamed Session");
    });

    it("rejects a regular member from updating the session name", async () => {
      currentAccountId = memberAccountId;

      const result = await updateSessionNameAction({
        groupId: "g1",
        sessionId: "s1",
        name: "Unauthorized Rename",
      });

      expect(result.ok).toBe(false);
      const session = await repository.getSession("s1");
      expect(session?.name).toBe("Original Session Name");
    });

    it("rejects empty session name", async () => {
      currentAccountId = hostAccountId;

      const result = await updateSessionNameAction({
        groupId: "g1",
        sessionId: "s1",
        name: "   ",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Session name cannot be blank");
    });

    it("returns error if session not found", async () => {
      currentAccountId = hostAccountId;

      const result = await updateSessionNameAction({
        groupId: "g1",
        sessionId: "non_existent",
        name: "New Name",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Session not found");
    });
  });
});

