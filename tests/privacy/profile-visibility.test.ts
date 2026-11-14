import { describe, it, expect } from "vitest";
import {
  resolveProfileVisibility,
  parseProfileVisibilitySettings,
} from "@/lib/privacy/profile-visibility";
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

  it("handles granular portion privacy settings: hides rating when ratingStats is only_you", () => {
    const customAccount: PlayerAccountRecord = {
      ...publicAccount,
      visibilitySettings: {
        profile: "everyone",
        activities: "everyone",
        ratingStats: "only_you",
        chemistry: "everyone",
        groups: "everyone",
      },
    };

    const view = resolveProfileVisibility("viewer_other", customAccount, stats);
    expect(view.isRestricted).toBe(false);
    expect(view.rating).toBeUndefined();
    expect(view.skillLevel).toBeUndefined();
    expect(view.bestPartner?.username).toBe("top_partner");
  });

  it("handles group_members visibility: permits group members and hides from non-members", () => {
    const groupRestrictedAccount: PlayerAccountRecord = {
      ...publicAccount,
      visibilitySettings: {
        profile: "everyone",
        activities: "group_members",
        ratingStats: "group_members",
        chemistry: "group_members",
        groups: "group_members",
      },
    };

    // Non-group member viewer
    const nonMemberView = resolveProfileVisibility("viewer_external", groupRestrictedAccount, stats, {
      isGroupMember: false,
    });
    expect(nonMemberView.isRestricted).toBe(false);
    expect(nonMemberView.rating).toBeUndefined();
    expect(nonMemberView.bestPartner).toBeNull();

    // Group member viewer
    const memberView = resolveProfileVisibility("viewer_member", groupRestrictedAccount, stats, {
      isGroupMember: true,
    });
    expect(memberView.isRestricted).toBe(false);
    expect(memberView.rating).toBe(1400);
    expect(memberView.bestPartner?.username).toBe("top_partner");
  });

  it("enforces the ceiling rule in parseProfileVisibilitySettings", () => {
    // When profile is only_you, all portions clamp to only_you even if passed as everyone
    const clampedToOnlyYou = parseProfileVisibilitySettings({
      profile: "only_you",
      activities: "everyone",
      ratingStats: "group_members",
      chemistry: "everyone",
      groups: "everyone",
    });
    expect(clampedToOnlyYou).toEqual({
      profile: "only_you",
      activities: "only_you",
      ratingStats: "only_you",
      chemistry: "only_you",
      groups: "only_you",
    });

    // When profile is group_members, portions passed as everyone clamp to group_members
    const clampedToGroup = parseProfileVisibilitySettings({
      profile: "group_members",
      activities: "everyone",
      ratingStats: "group_members",
      chemistry: "only_you",
      groups: "everyone",
    });
    expect(clampedToGroup).toEqual({
      profile: "group_members",
      activities: "group_members",
      ratingStats: "group_members",
      chemistry: "only_you",
      groups: "group_members",
    });

    // When profile is everyone, all valid levels are preserved
    const unclamped = parseProfileVisibilitySettings({
      profile: "everyone",
      activities: "everyone",
      ratingStats: "group_members",
      chemistry: "only_you",
      groups: "everyone",
    });
    expect(unclamped).toEqual({
      profile: "everyone",
      activities: "everyone",
      ratingStats: "group_members",
      chemistry: "only_you",
      groups: "everyone",
    });
  });

  it("safely parses JSON string visibilitySettings (e.g. from postgres/sqlite)", () => {
    const jsonString = JSON.stringify({
      profile: "group_members",
      activities: "group_members",
      ratingStats: "only_you",
      chemistry: "group_members",
      groups: "group_members",
    });

    const parsed = parseProfileVisibilitySettings(jsonString, true);
    expect(parsed).toEqual({
      profile: "group_members",
      activities: "group_members",
      ratingStats: "only_you",
      chemistry: "group_members",
      groups: "group_members",
    });

    // Malformed JSON falls back gracefully
    const fallback = parseProfileVisibilitySettings("{bad-json}", true);
    expect(fallback.profile).toBe("everyone");
  });

  it("preserves visibilitySettings in resolveProfileVisibility for non-owner viewers", () => {
    const groupMemberAccount: PlayerAccountRecord = {
      ...publicAccount,
      visibilitySettings: {
        profile: "group_members",
        activities: "group_members",
        ratingStats: "group_members",
        chemistry: "group_members",
        groups: "group_members",
      },
    };

    const view = resolveProfileVisibility("viewer_member", groupMemberAccount, stats, {
      isGroupMember: true,
    });
    expect(view.visibilitySettings?.profile).toBe("group_members");
  });
});
