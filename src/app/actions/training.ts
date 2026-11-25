"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  getActionRepository,
  getActivePlayerAccountId,
  getActiveGuestPlayerId,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type {
  GroupTrainingPlanItemRecord,
  GroupTrainingPlanRecord,
  PersonalTrainingPlanItemRecord,
  PersonalTrainingPlanRecord,
  TrainingResultParticipantRecord,
  TrainingResultRecord,
} from "@/lib/domain/types";
import {
  calculateAttemptPoints,
  calculateMetricValue,
  isBetterMetric,
  formatWeekOf,
  getWeekNumberFromDate,
} from "@/lib/domain/training-calculator";
import {
  publishWeeklyPlanSchema,
  personalWeeklyPlanSchema,
  recordTrainingResultSchema,
} from "@/lib/validation/training";

export async function recordTrainingResultAction(
  input: unknown,
): Promise<
  ActionResult<{
    resultId: string;
    metricValue: number;
    isPersonalBest: boolean;
    pointsEarned: number;
  }>
> {
  const parsed = recordTrainingResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    challengeId,
    groupId,
    planItemId,
    scorePrimary,
    scoreSecondary,
    completed,
    notes,
    participantPlayerIds,
  } = parsed.data;

  const repo = getActionRepository();
  const accountId = await getActivePlayerAccountId();
  const guestPlayerId = groupId ? await getActiveGuestPlayerId(groupId) : null;

  if (!accountId && !guestPlayerId) {
    return {
      ok: false,
      error: "You must be signed in or registered as a guest to record challenge results.",
    };
  }

  const challenge = await repo.getChallengeTemplate(challengeId);
  if (!challenge) {
    return { ok: false, error: "Challenge not found." };
  }

  let loggedByPlayerId: string | null = null;
  if (groupId) {
    const players = await repo.listPlayers(groupId, { includeInactive: false });
    const matching = accountId
      ? players.find((p) => p.accountId === accountId)
      : (guestPlayerId ? players.find((p) => p.id === guestPlayerId) : null);
    if (matching) {
      loggedByPlayerId = matching.id;
    }
  }

  const metricValue = calculateMetricValue(
    challenge.trackingFormat,
    scorePrimary,
    scoreSecondary,
  );

  const personalBests = await repo.getPlayerPersonalBests(
    accountId ?? undefined,
    loggedByPlayerId ?? undefined,
  );
  const currentBest = personalBests.get(challenge.id);
  const isPersonalBest =
    currentBest === undefined ||
    isBetterMetric(metricValue, currentBest, challenge.higherIsBetter);

  const metTargetBenchmark = Boolean(
    challenge.defaultTargetGoal &&
      (challenge.higherIsBetter
        ? metricValue >= challenge.defaultTargetGoal
        : metricValue <= challenge.defaultTargetGoal),
  );

  const pointsEarned = calculateAttemptPoints({
    isPersonalBest,
    metTargetBenchmark,
    isFirstAttemptToday: true,
  });

  const resultId = `tr_${randomUUID().slice(0, 12)}`;
  const result: TrainingResultRecord = {
    id: resultId,
    accountId: accountId ?? null,
    groupId: groupId ?? null,
    planItemId: groupId && planItemId ? planItemId : null,
    challengeId: challenge.id,
    loggedByPlayerId,
    scorePrimary,
    scoreSecondary: scoreSecondary ?? null,
    metricValue,
    completed,
    notes: notes ?? null,
    recordedAt: new Date(),
    version: 1,
  };

  const participants: TrainingResultParticipantRecord[] = [];
  participants.push({
    id: `trp_${randomUUID().slice(0, 12)}`,
    resultId,
    accountId: accountId ?? null,
    playerId: loggedByPlayerId,
    role: "primary",
  });

  if (groupId && participantPlayerIds && participantPlayerIds.length > 0) {
    const groupPlayers = await repo.listPlayers(groupId, { includeInactive: false });
    for (const pId of participantPlayerIds) {
      if (pId !== loggedByPlayerId) {
        const p = groupPlayers.find((pl) => pl.id === pId);
        if (p) {
          participants.push({
            id: `trp_${randomUUID().slice(0, 12)}`,
            resultId,
            accountId: p.accountId ?? null,
            playerId: p.id,
            role: "partner",
          });
        }
      }
    }
  }

  await repo.recordTrainingResult(result, participants);

  revalidatePath("/training");
  if (groupId) {
    revalidatePath(`/g/${groupId}`);
    revalidatePath(`/g/${groupId}/training`);
  }

  return {
    ok: true,
    data: {
      resultId,
      metricValue,
      isPersonalBest,
      pointsEarned,
    },
  };
}

export async function publishWeeklyPlanAction(
  input: unknown,
): Promise<ActionResult<{ planId: string }>> {
  const parsed = publishWeeklyPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid plan parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { groupId, year, weekNumber, title, focusNotes, challengeIds, customGoals } = parsed.data;

  try {
    await requireOrganizer(groupId);
  } catch {
    return { ok: false, error: "You must be an organizer of this group to publish training plans." };
  }

  const repo = getActionRepository();
  const challenges = await Promise.all(
    challengeIds.map((cId) => repo.getChallengeTemplate(cId)),
  );
  if (challenges.some((c) => c && c.participantFormat === "individual")) {
    return { ok: false, error: "Individual drills cannot be added to a group plan." };
  }

  const accountId = await getActivePlayerAccountId();

  const planId = `tp_${groupId}_${year}_w${weekNumber}`;
  const now = new Date();

  const plan: GroupTrainingPlanRecord = {
    id: planId,
    groupId,
    year,
    weekNumber,
    title,
    focusNotes: focusNotes ?? null,
    status: "published",
    publishedAt: now,
    createdByAccountId: accountId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const items: GroupTrainingPlanItemRecord[] = challengeIds.map((cId, idx) => ({
    id: `tpi_${randomUUID().slice(0, 12)}`,
    planId,
    challengeId: cId,
    customGoalDescription: customGoals?.[cId] ?? null,
    targetBenchmark: null,
    sortOrder: idx,
  }));

  await repo.createWeeklyTrainingPlan(plan, items);

  revalidatePath(`/g/${groupId}`);
  revalidatePath(`/g/${groupId}/training`);
  revalidatePath("/training");

  return { ok: true, data: { planId } };
}

export async function savePersonalWeeklyPlanAction(
  input: unknown,
): Promise<ActionResult<{ planId: string }>> {
  const parsed = personalWeeklyPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid plan parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const accountId = await getActivePlayerAccountId();
  if (!accountId) {
    return { ok: false, error: "You must be signed in to create a personal training plan." };
  }

  const { year, weekNumber, title, focusNotes, challengeIds, customGoals } = parsed.data;
  const repo = getActionRepository();

  const challenges = await Promise.all(
    challengeIds.map((cId) => repo.getChallengeTemplate(cId)),
  );
  if (challenges.some((c) => c && c.participantFormat === "group")) {
    return { ok: false, error: "Group drills cannot be added to an individual plan." };
  }

  const planId = `ptp_${accountId}_${year}_w${weekNumber}`;
  const now = new Date();

  const plan: PersonalTrainingPlanRecord = {
    id: planId,
    accountId,
    year,
    weekNumber,
    title,
    focusNotes: focusNotes ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const items: PersonalTrainingPlanItemRecord[] = challengeIds.map((cId, idx) => ({
    id: `ptpi_${randomUUID().slice(0, 12)}`,
    planId,
    challengeId: cId,
    customGoalDescription: customGoals?.[cId] ?? null,
    targetBenchmark: null,
    sortOrder: idx,
  }));

  await repo.savePersonalWeeklyTrainingPlan(plan, items);

  revalidatePath("/training");
  return { ok: true, data: { planId } };
}

/**
 * Deletes a recorded attempt (used for undo) and returns the player's
 * personal best for that drill after the deletion.
 */
export async function deleteTrainingResultAction(input: {
  readonly resultId: string;
  readonly challengeId: string;
  readonly groupId?: string | null;
}): Promise<ActionResult<{ personalBest: number | null }>> {
  const { resultId, challengeId, groupId } = input ?? {};
  if (typeof resultId !== "string" || !resultId || typeof challengeId !== "string" || !challengeId) {
    return { ok: false, error: "Invalid result." };
  }

  const repo = getActionRepository();
  const accountId = await getActivePlayerAccountId();
  const guestPlayerId = !accountId && groupId ? await getActiveGuestPlayerId(groupId) : null;
  const actorId = accountId ?? guestPlayerId;

  if (!actorId) {
    return { ok: false, error: "You must be signed in to undo a result." };
  }

  const success = await repo.deleteTrainingResult(resultId, actorId);
  if (!success) {
    return { ok: false, error: "Couldn't undo this attempt. It may already be removed." };
  }

  const personalBests = await repo.getPlayerPersonalBests(
    accountId ?? undefined,
    guestPlayerId ?? undefined,
  );

  revalidatePath("/training");
  if (groupId) {
    revalidatePath(`/g/${groupId}`);
  }
  return { ok: true, data: { personalBest: personalBests.get(challengeId) ?? null } };
}

export async function addDrillToPersonalPlanAction(
  challengeId: string,
): Promise<ActionResult<{ planId: string; alreadyPresent: boolean }>> {
  const accountId = await getActivePlayerAccountId();
  if (!accountId) {
    return { ok: false, error: "You must be signed in to add drills to your personal plan." };
  }

  const repo = getActionRepository();
  const challenge = await repo.getChallengeTemplate(challengeId);
  if (!challenge) {
    return { ok: false, error: "Drill not found." };
  }

  if (challenge.participantFormat === "group") {
    return { ok: false, error: "Group drills cannot be added to an individual plan." };
  }

  const { year, weekNumber } = getWeekNumberFromDate();
  const existingPlan = await repo.getPersonalWeeklyTrainingPlan(accountId, year, weekNumber);

  if (existingPlan) {
    if (existingPlan.items.some((i) => i.challengeId === challengeId)) {
      return { ok: true, data: { planId: existingPlan.plan.id, alreadyPresent: true } };
    }
    if (existingPlan.items.length >= 6) {
      return { ok: false, error: "Your weekly plan already has the maximum of 6 drills." };
    }

    const newItem: PersonalTrainingPlanItemRecord = {
      id: `ptpi_${randomUUID().slice(0, 12)}`,
      planId: existingPlan.plan.id,
      challengeId,
      customGoalDescription: null,
      targetBenchmark: null,
      sortOrder: existingPlan.items.length,
    };

    await repo.savePersonalWeeklyTrainingPlan(existingPlan.plan, [
      ...existingPlan.items,
      newItem,
    ]);
    revalidatePath("/training");
    return { ok: true, data: { planId: existingPlan.plan.id, alreadyPresent: false } };
  }

  // Create new plan for current week with this drill
  const planId = `ptp_${accountId}_${year}_w${weekNumber}`;
  const now = new Date();
  const plan: PersonalTrainingPlanRecord = {
    id: planId,
    accountId,
    year,
    weekNumber,
    title: `Week of ${formatWeekOf(year, weekNumber)} Training Plan`,
    focusNotes: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const newItem: PersonalTrainingPlanItemRecord = {
    id: `ptpi_${randomUUID().slice(0, 12)}`,
    planId,
    challengeId,
    customGoalDescription: null,
    targetBenchmark: null,
    sortOrder: 0,
  };

  await repo.savePersonalWeeklyTrainingPlan(plan, [newItem]);
  revalidatePath("/training");
  return { ok: true, data: { planId, alreadyPresent: false } };
}

export async function addDrillToGroupPlanAction(
  groupId: string,
  challengeId: string,
): Promise<ActionResult<{ planId: string; alreadyPresent: boolean }>> {
  try {
    await requireOrganizer(groupId);
  } catch {
    return { ok: false, error: "You must be an organizer of this group to edit training plans." };
  }

  const accountId = await getActivePlayerAccountId();
  const repo = getActionRepository();
  const challenge = await repo.getChallengeTemplate(challengeId);
  if (!challenge) {
    return { ok: false, error: "Drill not found." };
  }

  if (challenge.participantFormat === "individual") {
    return { ok: false, error: "Individual drills cannot be added to a group plan." };
  }

  const { year, weekNumber } = getWeekNumberFromDate();
  const existingPlan = await repo.getWeeklyTrainingPlan(groupId, year, weekNumber);

  if (existingPlan) {
    if (existingPlan.items.some((i) => i.challengeId === challengeId)) {
      return { ok: true, data: { planId: existingPlan.plan.id, alreadyPresent: true } };
    }
    if (existingPlan.items.length >= 6) {
      return { ok: false, error: "This group's weekly plan already has the maximum of 6 drills." };
    }

    const newItem: GroupTrainingPlanItemRecord = {
      id: `tpi_${randomUUID().slice(0, 12)}`,
      planId: existingPlan.plan.id,
      challengeId,
      customGoalDescription: null,
      targetBenchmark: null,
      sortOrder: existingPlan.items.length,
    };

    await repo.createWeeklyTrainingPlan(existingPlan.plan, [
      ...existingPlan.items,
      newItem,
    ]);
    revalidatePath(`/g/${groupId}`);
    revalidatePath(`/g/${groupId}/training`);
    revalidatePath("/training");
    return { ok: true, data: { planId: existingPlan.plan.id, alreadyPresent: false } };
  }

  // Create new group plan with this drill
  const planId = `tp_${groupId}_${year}_w${weekNumber}`;
  const now = new Date();
  const plan: GroupTrainingPlanRecord = {
    id: planId,
    groupId,
    year,
    weekNumber,
    title: `Week of ${formatWeekOf(year, weekNumber)} Weekly Training`,
    focusNotes: null,
    status: "published",
    publishedAt: now,
    createdByAccountId: accountId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const newItem: GroupTrainingPlanItemRecord = {
    id: `tpi_${randomUUID().slice(0, 12)}`,
    planId,
    challengeId,
    customGoalDescription: null,
    targetBenchmark: null,
    sortOrder: 0,
  };

  await repo.createWeeklyTrainingPlan(plan, [newItem]);
  revalidatePath(`/g/${groupId}`);
  revalidatePath(`/g/${groupId}/training`);
  revalidatePath("/training");
  return { ok: true, data: { planId, alreadyPresent: false } };
}

