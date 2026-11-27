import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import { getWeekNumberFromDate } from "@/lib/domain/training-calculator";
import { NewPlanForm } from "./new-plan-form";

function safeReturnPath(path: string | undefined): string | undefined {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : undefined;
}

export default async function NewWeeklyPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const [{ groupId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const repo = getActionRepository();

  const [group, challenges] = await Promise.all([
    repo.getGroup(groupId),
    repo.listChallengeTemplates(groupId),
  ]);

  if (!group) {
    redirect("/players/groups");
  }

  const returnTo = safeReturnPath(resolvedSearchParams?.returnTo);
  const cancelHref = returnTo ?? `/g/${groupId}`;

  try {
    await requireOrganizer(groupId);
  } catch {
    redirect(cancelHref);
  }

  // Calculate current week
  const { year: currentYear, weekNumber: currentWeekNumber } = getWeekNumberFromDate();

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6 text-black pb-28 sm:pb-24 md:pb-12">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-neutral-500 block mb-0.5">
            {group.name}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black leading-tight">
            Create Weekly Training Plan
          </h1>
        </div>
        <Link
          href={cancelHref}
          className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all shrink-0"
        >
          Cancel
        </Link>
      </div>

      <NewPlanForm
        groupId={groupId}
        challenges={challenges}
        defaultWeekNumber={currentWeekNumber}
        defaultYear={currentYear}
        returnTo={returnTo}
      />
    </main>
  );
}

