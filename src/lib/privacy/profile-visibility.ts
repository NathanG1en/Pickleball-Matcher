import type { PlayerAccountRecord } from "@/lib/domain/types";

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
}

export function resolveProfileVisibility(
  viewerAccountId: string | null,
  targetAccount: PlayerAccountRecord,
  stats: {
    bestPartner: BestPartnerData | null;
    viewerSynergyScore: number | null;
  }
): SanitizedProfileView {
  const isOwner = viewerAccountId === targetAccount.id;
  const isRestricted = !targetAccount.isPublic && !isOwner;

  if (isRestricted) {
    return {
      accountId: targetAccount.id,
      username: targetAccount.username,
      name: targetAccount.name,
      isPublic: false,
      isRestricted: true,
    };
  }

  return {
    accountId: targetAccount.id,
    username: targetAccount.username,
    name: targetAccount.name,
    isPublic: targetAccount.isPublic ?? true,
    isRestricted: false,
    skillLevel: targetAccount.skillLevel,
    rating: targetAccount.initialRating,
    bestPartner: stats.bestPartner,
    viewerSynergyScore: stats.viewerSynergyScore,
  };
}
