"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePersonalWeeklyPlanAction } from "@/app/actions/training";
import type { ChallengeTemplateRecord, PersonalTrainingPlanRecord, PersonalTrainingPlanItemRecord } from "@/lib/domain/types";
import { CheckIcon } from "@/components/ui/icons";

export interface PersonalPlanFormProps {
  readonly challenges: readonly ChallengeTemplateRecord[];
  readonly defaultWeekNumber: number;
  readonly defaultYear: number;
  readonly existingPlan?: {
    readonly plan: PersonalTrainingPlanRecord;
    readonly items: readonly PersonalTrainingPlanItemRecord[];
  } | null;
}

export function PersonalPlanForm({
  challenges,
  defaultWeekNumber,
  defaultYear,
  existingPlan,
}: PersonalPlanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [weekNumber, setWeekNumber] = useState(
    existingPlan?.plan.weekNumber ?? defaultWeekNumber,
  );
  const [year] = useState(existingPlan?.plan.year ?? defaultYear);
  const [title, setTitle] = useState(
    existingPlan?.plan.title ?? `Week ${defaultWeekNumber} Personal Training Plan`,
  );
  const [focusNotes, setFocusNotes] = useState(
    existingPlan?.plan.focusNotes ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (existingPlan && existingPlan.items.length > 0) {
      return existingPlan.items.map((i) => i.challengeId);
    }
    return challenges.slice(0, 3).map((c) => c.id);
  });
  const [customGoals, setCustomGoals] = useState<Record<string, string>>(() => {
    const goals: Record<string, string> = {};
    if (existingPlan) {
      for (const item of existingPlan.items) {
        if (item.customGoalDescription) {
          goals[item.challengeId] = item.customGoalDescription;
        }
      }
    }
    return goals;
  });
  const [error, setError] = useState<string | null>(null);

  const toggleChallenge = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const setGoalForChallenge = (id: string, goal: string) => {
    setCustomGoals((prev) => ({
      ...prev,
      [id]: goal,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError("Please select at least 1 challenge.");
      return;
    }

    if (selectedIds.length > 6) {
      setError("Maximum 6 challenges per week.");
      return;
    }

    startTransition(async () => {
      const res = await savePersonalWeeklyPlanAction({
        year,
        weekNumber,
        title,
        focusNotes: focusNotes.trim() ? focusNotes.trim() : null,
        challengeIds: selectedIds,
        customGoals,
      });

      if (res.ok) {
        router.push("/training");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-100 text-rose-900 border-2 border-rose-500 font-bold text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Plan Details Card */}
      <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
        <h2 className="font-display text-base sm:text-lg font-black uppercase text-black">
          Plan Details
        </h2>

        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label htmlFor="plan-title" className="block text-xs font-black uppercase text-neutral-700 mb-1">
              Plan Title
            </label>
            <input
              id="plan-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 sm:h-12 px-3 text-base font-bold rounded-xl border-2 border-black bg-white focus:outline-none focus:bg-[#FFFDF7]"
            />
          </div>

          <div>
            <label htmlFor="week-number" className="block text-xs font-black uppercase text-neutral-700 mb-1">
              Week Number (1–53)
            </label>
            <input
              id="week-number"
              type="number"
              min={1}
              max={53}
              required
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value))}
              className="w-full h-11 sm:h-12 px-3 text-base font-bold rounded-xl border-2 border-black bg-white focus:outline-none focus:bg-[#FFFDF7]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="focus-notes" className="block text-xs font-black uppercase text-neutral-700 mb-1">
            Focus Notes & Weekly Goals (Optional)
          </label>
          <textarea
            id="focus-notes"
            rows={2}
            value={focusNotes}
            onChange={(e) => setFocusNotes(e.target.value)}
            placeholder="e.g. Focus on soft hands, kitchen patience, and 3rd shot drop depth."
            className="w-full p-3 text-base font-bold rounded-xl border-2 border-black bg-white focus:outline-none focus:bg-[#FFFDF7]"
          />
        </div>
      </section>

      {/* Challenge Picker Card */}
      <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <h2 className="font-display text-base sm:text-lg font-black uppercase text-black">
            Select Focus Drills ({selectedIds.length} Selected)
          </h2>
          <span className="text-xs font-bold text-neutral-500">Pick 1 to 6 drills</span>
        </div>

        <div className="space-y-2.5">
          {challenges.map((challenge) => {
            const isSelected = selectedIds.includes(challenge.id);
            return (
              <div
                key={challenge.id}
                className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? "bg-[#ccff00]/15 border-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white border-black/30 hover:border-black"
                }`}
              >
                <div
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => toggleChallenge(challenge.id)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggleChallenge(challenge.id);
                    }
                  }}
                  className="w-full text-left flex items-start gap-2.5 sm:gap-3 cursor-pointer touch-manipulation select-none"
                >
                  <span
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? "bg-[#ccff00] border-black text-black"
                        : "border-black/30 bg-white"
                    }`}
                  >
                    {isSelected && <CheckIcon className="w-4 h-4 stroke-3" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-display text-sm font-black uppercase text-black">
                        {challenge.title}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-neutral-100 text-[10px] font-bold uppercase text-neutral-700 border border-black/10">
                        {challenge.skillCategory}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-[10px] font-bold uppercase text-amber-900 border border-amber-300">
                        {challenge.trackingFormat}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 line-clamp-2">
                      {challenge.description}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-2.5 pt-2.5 border-t border-black/15">
                    <label htmlFor={`goal-${challenge.id}`} className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                      Custom Goal / Benchmark (Optional)
                    </label>
                    <input
                      id={`goal-${challenge.id}`}
                      type="text"
                      placeholder={challenge.defaultTargetGoal ? `Target: ${challenge.defaultTargetGoal} ${challenge.scoreUnit}` : `e.g. 30 ${challenge.scoreUnit}`}
                      value={customGoals[challenge.id] ?? ""}
                      onChange={(e) => setGoalForChallenge(challenge.id, e.target.value)}
                      className="w-full h-10 px-3 text-base sm:text-xs font-bold rounded-xl border border-black/30 focus:border-black bg-white focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isPending || selectedIds.length === 0}
          className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-base sm:text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 touch-manipulation select-none"
        >
          {isPending ? "Saving Plan..." : "Save Weekly Training Plan →"}
        </button>
      </div>
    </form>
  );
}

