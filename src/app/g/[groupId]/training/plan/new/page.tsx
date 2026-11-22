import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import { NewPlanForm } from "./new-plan-form";

export default async function NewWeeklyPlanPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const repo = getActionRepository();

  const [group, challenges] = await Promise.all([
    repo.getGroup(groupId),
    repo.listChallengeTemplates(groupId),
  ]);

  if (!group) {
    redirect("/players/groups");
  }

  try {
    await requireOrganizer(groupId);
  } catch {
    redirect(`/g/${groupId}`);
  }

  // Calculate current ISO week
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const currentWeekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6 text-black pb-28 sm:pb-24 md:pb-12">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <span className="font-display text-xs font-black uppercase text-neutral-500 block mb-0.5">
            {group.name}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black leading-tight">
            Create Weekly Training Plan
          </h1>
        </div>
        <Link
          href={`/g/${groupId}`}
          className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all shrink-0"
        >
          Cancel
        </Link>
      </div>

      <NewPlanForm
        groupId={groupId}
        challenges={challenges}
        defaultWeekNumber={currentWeekNumber}
        defaultYear={now.getFullYear()}
      />
    </main>
  );
}

