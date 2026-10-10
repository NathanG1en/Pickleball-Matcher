import { describe, it, expect } from "vitest";
import { resolveProfileVisibility } from "@/lib/privacy/profile-visibility";
import type { PlayerAccountRecord } from "@/lib/domain/types";

describe("resolveProfileVisibility", () => {
  const publicAccount: PlayerAccountRecord = {
    id: "acc_1",
    username: "pickle_pro",
    name: "Alex Pro",
    isPublic: true,
    passwordHash: "hash1",
    skillLevel: "advanced",
    initialRating: 1400,
    createdAt: new Date(),
  };

  const privateAccount: PlayerAccountRecord = {
    id: "acc_2",
    username: "stealth_ace",
    name: "Sam Stealth",
    isPublic: false,
    passwordHash: "hash2",
    skillLevel: "intermediate",
    initialRating: 1100,
    createdAt: new Date(),
  };

  const stats = {
    bestPartner: {
      partnerAccountId: "acc_3",
      username: "top_partner",
      synergyScore: 88,
      matchesPlayed: 12,
    },
    viewerSynergyScore: 75,
  };

  it("returns full profile when target is public", () => {
    const view = resolveProfileVisibility("viewer_acc", publicAccount, stats);
    expect(view.isRestricted).toBe(false);
    expect(view.username).toBe("pickle_pro");
    expect(view.rating).toBe(1400);
    expect(view.bestPartner?.username).toBe("top_partner");
    expect(view.viewerSynergyScore).toBe(75);
  });

  it("strips ratings and partner stats when target is private and viewer is another user", () => {
    const view = resolveProfileVisibility("viewer_acc", privateAccount, stats);
    expect(view.isRestricted).toBe(true);
    expect(view.username).toBe("stealth_ace");
    expect(view.name).toBe("Sam Stealth");
    expect(view.rating).toBeUndefined();
    expect(view.skillLevel).toBeUndefined();
    expect(view.bestPartner).toBeUndefined();
  });

  it("returns full profile when viewer is the owner even if account is private", () => {
    const view = resolveProfileVisibility("acc_2", privateAccount, stats);
    expect(view.isRestricted).toBe(false);
    expect(view.username).toBe("stealth_ace");
    expect(view.rating).toBe(1100);
    expect(view.bestPartner?.username).toBe("top_partner");
  });
});
