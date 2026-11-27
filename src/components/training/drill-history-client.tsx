"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrainingResultAction } from "@/app/actions/training";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";
import type { LastResultSummary } from "@/lib/domain/training-history";
import { InlineResultLogger, type RosterPlayerOption } from "@/components/training/inline-result-logger";

/** Result logger for the drill history page; refreshes the history after a save or undo. */
export function DrillHistoryLogger({
  challenge,
  groupId,
  rosterPlayers,
  lastResult,
}: {
  readonly challenge: ChallengeTemplateRecord;
  readonly groupId?: string | null;
  readonly rosterPlayers?: readonly RosterPlayerOption[];
  readonly lastResult: LastResultSummary | null;
}) {
  const router = useRouter();
  return (
    <InlineResultLogger
      challenge={challenge}
      groupId={groupId}
      rosterPlayers={rosterPlayers}
      lastResult={lastResult}
      onResultSaved={() => router.refresh()}
      onResultUndone={() => router.refresh()}
    />
  );
}

/** Two-step delete for correcting a logged attempt from the history list. */
export function DeleteAttemptButton({
  resultId,
  challengeId,
  groupId,
  attemptLabel,
}: {
  readonly resultId: string;
  readonly challengeId: string;
  readonly groupId?: string | null;
  /** Describes the attempt for screen readers, e.g. "16/20 (80%) on Nov 18". */
  readonly attemptLabel: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        aria-label={`Delete attempt ${attemptLabel}`}
        className="min-h-[36px] px-2.5 rounded-lg text-xs font-bold text-neutral-600 hover:text-black hover:bg-neutral-100 cursor-pointer touch-manipulation select-none"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {error && (
        <span role="alert" className="text-[11px] font-bold text-rose-700">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const res = await deleteTrainingResultAction({ resultId, challengeId, groupId: groupId ?? null });
            if (res.ok) {
              setConfirming(false);
              router.refresh();
            } else {
              setError(res.error);
            }
          });
        }}
        aria-label={`Confirm delete attempt ${attemptLabel}`}
        className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white border border-black text-xs font-bold cursor-pointer touch-manipulation select-none disabled:opacity-50"
      >
        {isPending ? "Deleting..." : error ? "Retry delete" : "Delete"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="min-h-[36px] px-2.5 rounded-lg bg-white border border-black text-xs font-bold cursor-pointer touch-manipulation select-none"
      >
        Keep
      </button>
    </div>
  );
}
