import { z } from "zod";

export const tournamentDivisionSchema = z.enum([
  "mens_singles",
  "womens_singles",
  "mens_doubles",
  "womens_doubles",
  "mixed_doubles",
]);

export const createTournamentSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  name: z.string().trim().min(1, "Tournament name is required").max(100, "Tournament name is too long"),
  divisions: z.array(tournamentDivisionSchema).min(1, "Select at least one division"),
  playerIds: z.array(z.string()).min(2, "Select at least 2 players"),
  playerGenders: z.record(z.string(), z.enum(["male", "female"]).nullable()).optional(),
});

export const updateTournamentStatusSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().min(1),
  status: z.enum(["draft", "active", "completed"]),
});

export const updateTournamentNameSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

export const updateTournamentMatchSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().min(1),
  division: tournamentDivisionSchema,
  matchId: z.string().min(1),
  winnerId: z.string().nullable().optional(),
  score1: z.number().int().min(0).max(99).nullable().optional(),
  score2: z.number().int().min(0).max(99).nullable().optional(),
});

export const swapTournamentSlotsSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().min(1),
  division: tournamentDivisionSchema,
  match1Id: z.string().min(1),
  slot1: z.union([z.literal(1), z.literal(2)]),
  match2Id: z.string().min(1),
  slot2: z.union([z.literal(1), z.literal(2)]),
});

export const reshuffleDivisionSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().min(1),
  division: tournamentDivisionSchema,
});

export const editParticipantSlotSchema = z.object({
  tournamentId: z.string().min(1),
  groupId: z.string().min(1),
  division: tournamentDivisionSchema,
  matchId: z.string().min(1),
  slot: z.union([z.literal(1), z.literal(2)]),
  newParticipantId: z.string().nullable(),
});

