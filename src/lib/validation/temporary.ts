import { z } from "zod";

const courtSizeSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const tempCourtSchema = z.object({
  courtNumber: z.number().int().positive(),
  team1: z.array(z.string().min(1).max(128)).min(1).max(2),
  team2: z.array(z.string().min(1).max(128)).min(1).max(2),
  team1Score: z.number().int().min(0).nullable(),
  team2Score: z.number().int().min(0).nullable(),
}).strict().refine((court) => (court.team1Score === null) === (court.team2Score === null), "Enter both scores or leave both blank.")
  .refine((court) => court.team1Score === null || court.team2Score === null || court.team1Score !== court.team2Score, "Match scores cannot be tied.")
  .refine((court) => (court.team1.length === 1 && court.team2.length === 1) ||
    (court.team1.length === 2 && court.team2.length === 2) ||
    (court.team1.length === 2 && court.team2.length === 1) ||
    (court.team1.length === 1 && court.team2.length === 2), "A court must be 1v1, 2v2, or 2v1.");

const tempRoundSchema = z.object({
  roundNumber: z.number().int().positive(),
  seed: z.number().int().min(0).max(0xffff_ffff),
  courts: z.array(tempCourtSchema).min(1).max(6),
  sitting: z.array(z.string().min(1).max(128)),
}).strict();
type TemporaryRoundInput = z.infer<typeof tempRoundSchema>;

function checkRound(round: TemporaryRoundInput, expectedNumber: number, data: { courtPlayerCounts: readonly number[]; players: readonly { id: string }[] }, path: (string | number)[], context: z.RefinementCtx, requireScores: boolean) {
  const playerIds = data.players.map((player) => player.id);
  const playerSet = new Set(playerIds);
  if (round.roundNumber !== expectedNumber) context.addIssue({ code: "custom", path: [...path, "roundNumber"], message: "Round numbers must be sequential." });
  if (round.courts.length !== data.courtPlayerCounts.length) context.addIssue({ code: "custom", path: [...path, "courts"], message: "Each round must include all configured courts." });
  const assigned = [...round.courts.flatMap((court) => [...court.team1, ...court.team2]), ...round.sitting];
  if (assigned.length !== playerIds.length || new Set(assigned).size !== assigned.length || assigned.some((id) => !playerSet.has(id))) {
    context.addIssue({ code: "custom", path, message: "Every player must appear exactly once in each round." });
  }
  round.courts.forEach((court, courtIndex) => {
    const size = court.team1.length + court.team2.length;
    if (size !== data.courtPlayerCounts[courtIndex]) context.addIssue({ code: "custom", path: [...path, "courts", courtIndex], message: "Court assignments must match the configured court sizes." });
    if (requireScores && (court.team1Score === null || court.team2Score === null)) context.addIssue({ code: "custom", path: [...path, "courts", courtIndex], message: "Saved rounds need a score for every court." });
  });
}

export const saveTemporaryGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isPublic: z.boolean(),
  courtPlayerCounts: z.array(courtSizeSchema).min(1).max(6),
  players: z.array(z.object({ id: z.string().min(1).max(128), name: z.string().trim().min(1).max(80), rating: z.number().finite().min(100).max(3_000) }).strict()).min(2).max(24),
  rounds: z.array(tempRoundSchema).max(100),
  currentRound: tempRoundSchema.nullable().optional(),
}).strict().superRefine((data, context) => {
  const playerIds = data.players.map((player) => player.id);
  const playerSet = new Set(playerIds);
  if (playerSet.size !== playerIds.length) context.addIssue({ code: "custom", path: ["players"], message: "Player IDs must be unique." });
  if (data.courtPlayerCounts.reduce((sum, size) => sum + size, 0) > playerIds.length) context.addIssue({ code: "custom", path: ["courtPlayerCounts"], message: "Court capacity cannot exceed the roster." });
  for (const [index, round] of data.rounds.entries()) {
    checkRound(round, index + 1, data, ["rounds", index], context, true);
  }
  if (data.currentRound) checkRound(data.currentRound, data.rounds.length + 1, data, ["currentRound"], context, false);
});
