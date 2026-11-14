import type {
  PlayerAccountRecord,
  ProfileVisibilityLevel,
  ProfileVisibilitySettings,
} from "@/lib/domain/types";

export interface BestPartnerData {
  readonly partnerAccountId: string;
  readonly username: string;
  readonly synergyScore: number;
  readonly matchesPlayed: number;
}

export interface SanitizedProfileView {
  readonly accountId: string;
  readonly username: string;
  readonly name: string;
  readonly isPublic: boolean;
  readonly isRestricted: boolean;
  readonly skillLevel?: "beginner" | "intermediate" | "advanced";
  readonly rating?: number;
  readonly bestPartner?: BestPartnerData | null;
  readonly viewerSynergyScore?: number | null;
  readonly visibilitySettings?: ProfileVisibilitySettings;
}

export const PROFILE_VISIBILITY_RANKS: Record<ProfileVisibilityLevel, number> = {
  only_you: 1,
  group_members: 2,
  everyone: 3,
};

export function clampVisibilityLevel(
  level: ProfileVisibilityLevel,
  ceiling: ProfileVisibilityLevel,
): ProfileVisibilityLevel {
  return PROFILE_VISIBILITY_RANKS[level] > PROFILE_VISIBILITY_RANKS[ceiling] ? ceiling : level;
}

export function parseProfileVisibilitySettings(
  raw: unknown,
  fallbackIsPublic: boolean = true,
): ProfileVisibilitySettings {
  const defaultLevel: ProfileVisibilityLevel = fallbackIsPublic ? "everyone" : "only_you";
  const defaults: ProfileVisibilitySettings = {
    profile: defaultLevel,
    activities: defaultLevel,
    ratingStats: defaultLevel,
    chemistry: defaultLevel,
    groups: defaultLevel,
  };

  let dataObj = raw;
  if (typeof raw === "string") {
    try {
      dataObj = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }

  if (!dataObj || typeof dataObj !== "object") {
    return defaults;
  }

  const data = dataObj as Record<string, unknown>;
  const validLevel = (lvl: unknown, fallback: ProfileVisibilityLevel): ProfileVisibilityLevel => {
    if (lvl === "everyone" || lvl === "group_members" || lvl === "only_you") return lvl;
    return fallback;
  };

  const profile = validLevel(data.profile, defaults.profile);

  return {
    profile,
    activities: clampVisibilityLevel(validLevel(data.activities, defaults.activities), profile),
    ratingStats: clampVisibilityLevel(
      validLevel(data.ratingStats ?? data.rating_stats, defaults.ratingStats),
      profile,
    ),
    chemistry: clampVisibilityLevel(validLevel(data.chemistry, defaults.chemistry), profile),
    groups: clampVisibilityLevel(validLevel(data.groups, defaults.groups), profile),
  };
}

export function canViewPortion({
  portion,
  viewerAccountId,
  targetAccount,
  isGroupMember = false,
}: {
  portion: keyof ProfileVisibilitySettings;
  viewerAccountId: string | null;
  targetAccount: PlayerAccountRecord;
  isGroupMember?: boolean;
}): boolean {
  // Account owners can always view all portions of their own profile
  if (viewerAccountId && viewerAccountId === targetAccount.id) {
    return true;
  }

  const settings = parseProfileVisibilitySettings(
    targetAccount.visibilitySettings,
    targetAccount.isPublic ?? true,
  );

  // Overall account privacy check
  if (targetAccount.isPublic === false || settings.profile === "only_you") {
    return false;
  }
  if (settings.profile === "group_members" && !isGroupMember) {
    return false;
  }

  // Portion-specific privacy check
  const portionLevel = settings[portion];
  if (portionLevel === "everyone") {
    return true;
  }
  if (portionLevel === "group_members") {
    return Boolean(isGroupMember);
  }
  return false;
}

export function resolveProfileVisibility(
  viewerAccountId: string | null,
  targetAccount: PlayerAccountRecord,
  stats: {
    bestPartner: BestPartnerData | null;
    viewerSynergyScore: number | null;
  },
  options?: {
    isGroupMember?: boolean;
  },
): SanitizedProfileView {
  const isOwner = Boolean(viewerAccountId && viewerAccountId === targetAccount.id);
  const isGroupMember = Boolean(options?.isGroupMember);
  const settings = parseProfileVisibilitySettings(
    targetAccount.visibilitySettings,
    targetAccount.isPublic ?? true,
  );

  const canViewOverall = isOwner || canViewPortion({
    portion: "profile",
    viewerAccountId,
    targetAccount,
    isGroupMember,
  });

  if (!canViewOverall) {
    return {
      accountId: targetAccount.id,
      username: targetAccount.username,
      name: targetAccount.name,
      isPublic: false,
      isRestricted: true,
      visibilitySettings: settings,
    };
  }

  const canViewRatingStats = isOwner || canViewPortion({
    portion: "ratingStats",
    viewerAccountId,
    targetAccount,
    isGroupMember,
  });

  const canViewChemistry = isOwner || canViewPortion({
    portion: "chemistry",
    viewerAccountId,
    targetAccount,
    isGroupMember,
  });

  return {
    accountId: targetAccount.id,
    username: targetAccount.username,
    name: targetAccount.name,
    isPublic: targetAccount.isPublic ?? (settings.profile !== "only_you"),
    isRestricted: false,
    skillLevel: canViewRatingStats ? targetAccount.skillLevel : undefined,
    rating: canViewRatingStats ? (targetAccount.rating ?? targetAccount.initialRating) : undefined,
    bestPartner: canViewChemistry ? stats.bestPartner : null,
    viewerSynergyScore: canViewChemistry ? stats.viewerSynergyScore : null,
    visibilitySettings: settings,
  };
}
