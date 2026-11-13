import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccountGroupAction } from "@/app/actions/auth";
import { setActionRepository } from "@/app/actions/action-context";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

const mockAccountId = vi.fn<() => string | null>();

vi.mock("@/app/actions/action-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/action-context")>();
  return {
    ...actual,
    requirePlayer: async () => {
      const id = mockAccountId();
      if (!id) throw new Error("Not signed in");
      return id;
    },
  };
});

describe("createAccountGroupAction error recovery", () => {
  let repository: InMemoryRepositories;

  beforeEach(() => {
    repository = new InMemoryRepositories();
    setActionRepository(repository);
    mockAccountId.mockReturnValue("acc_host");
  });

  afterEach(() => {
    setActionRepository(null);
    vi.restoreAllMocks();
  });

  it("never shows raw database errors to organizers", async () => {
    vi.spyOn(repository, "insertGroup").mockRejectedValue(new Error('column "organizer_permissions" does not exist'));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createAccountGroupAction({ name: "Tuesday Doubles", isPublic: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toContain("organizer_permissions");
    expect(result.error).toContain("try again");
    expect(consoleError).toHaveBeenCalled();
  });

  it("tells signed-out players to sign in", async () => {
    mockAccountId.mockReturnValue(null);

    const result = await createAccountGroupAction({ name: "Tuesday Doubles", isPublic: false });

    expect(result).toEqual({ ok: false, error: "Sign in to your player account to create a group." });
  });
});
