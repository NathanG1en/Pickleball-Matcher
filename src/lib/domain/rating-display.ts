export const DUPR_BASE_ELO = 1000;
export const DUPR_BASE_RATING = 3.5;
export const ELO_PER_DUPR = 400;

export const DUPR_MIN = 2.0;
export const DUPR_MAX = 8.0;

export const DUPR_PRESETS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5] as const;

export interface SkillTier {
  readonly id: string;
  readonly name: string;
  readonly minDupr: number;
  readonly maxDupr: number;
  readonly range: string;
  readonly description: string;
  readonly defaultPreset?: number;
}

export const SKILL_TIERS: readonly SkillTier[] = [
  {
    id: "beginner",
    name: "Beginner",
    minDupr: 2.0,
    maxDupr: 2.499,
    range: "2.000 - 2.499",
    description: "At this level, players have a basic idea of the game and are working on building basic skills.",
    defaultPreset: 2.0,
  },
  {
    id: "advanced_beginner",
    name: "Advanced Beginner",
    minDupr: 2.5,
    maxDupr: 2.999,
    range: "2.500 - 2.999",
    description: "This group of players is more consistent and is beginning to understand how to play strategically.",
    defaultPreset: 2.5,
  },
  {
    id: "intermediate",
    name: "Intermediate",
    minDupr: 3.0,
    maxDupr: 3.499,
    range: "3.000 - 3.499",
    description: "This level shows that you are consistent, that your shots are accurate, and that you play the game strategically.",
    defaultPreset: 3.0,
  },
  {
    id: "advanced_intermediate",
    name: "Advanced Intermediate",
    minDupr: 3.5,
    maxDupr: 3.999,
    range: "3.500 - 3.999",
    description: "At this point, players have good basic skills and can think strategically. They may also be starting to play against others.",
    defaultPreset: 3.5,
  },
  {
    id: "competitive",
    name: "Competitive",
    minDupr: 4.0,
    maxDupr: 4.499,
    range: "4.000 - 4.499",
    description: "In this bracket, some people are very skilled and can do well in neighborhood and regional tournaments.",
    defaultPreset: 4.0,
  },
  {
    id: "advanced_competitive",
    name: "Advanced Competitive",
    minDupr: 4.5,
    maxDupr: 4.999,
    range: "4.500 - 4.999",
    description: "At this level, players have very good skills and can do well in national events.",
    defaultPreset: 4.5,
  },
  {
    id: "expert",
    name: "Expert",
    minDupr: 5.0,
    maxDupr: 5.499,
    range: "5.000 - 5.499",
    description: "At this level, the best players compete in high-level tournaments and show off amazing skills and knowledge of the game.",
  },
  {
    id: "professional",
    name: "Professional",
    minDupr: 5.5,
    maxDupr: 5.999,
    range: "5.500 - 5.999",
    description: "Top players fight at the national level, showing that they are the best and most consistent.",
  },
  {
    id: "world_class",
    name: "World-Class Professional",
    minDupr: 6.0,
    maxDupr: 8.0,
    range: "6.000 - 8.000",
    description: "These players are among the best in the world and are only allowed to play professionally. They show great skill, planning, and consistency.",
  },
] as const;

export function eloToDupr(elo: number): number {
  const raw = DUPR_BASE_RATING + (elo - DUPR_BASE_ELO) / ELO_PER_DUPR;
  return Math.min(DUPR_MAX, Math.max(DUPR_MIN, raw));
}

export function duprToElo(dupr: number): number {
  const clamped = Math.min(DUPR_MAX, Math.max(DUPR_MIN, dupr));
  return Math.round(DUPR_BASE_ELO + (clamped - DUPR_BASE_RATING) * ELO_PER_DUPR);
}

export function formatDuprValue(dupr: number): string {
  return Number(dupr.toFixed(3)).toString();
}

export function formatDupr(elo: number): string {
  return formatDuprValue(eloToDupr(elo));
}

export function formatDuprDelta(deltaElo: number): string {
  const deltaDupr = deltaElo / ELO_PER_DUPR;
  const rounded = Number(deltaDupr.toFixed(3));
  if (rounded === 0) {
    return "+0";
  }
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toString()}`;
}

export function normalizeInitialRating(input: number): number {
  if (input <= DUPR_MAX) {
    return duprToElo(input);
  }
  return Math.round(input);
}

export function getSkillTier(dupr: number): SkillTier {
  const clamped = Math.min(DUPR_MAX, Math.max(DUPR_MIN, dupr));
  for (let i = SKILL_TIERS.length - 1; i >= 0; i -= 1) {
    if (clamped >= SKILL_TIERS[i].minDupr) {
      return SKILL_TIERS[i];
    }
  }
  return SKILL_TIERS[0];
}
