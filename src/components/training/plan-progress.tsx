import React from "react";

/** True when a plan title is the auto-generated "Week of … Plan" text, which repeats the week shown above it. */
export function isGeneratedPlanTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  return /^Week of .+ (Training Plan|Challenge Plan|Weekly Training)$/.test(title.trim());
}

/** Progress bar with a plain-language count of plan drills practiced this week. */
export function PlanProgress({ completed, total }: { readonly completed: number; readonly total: number }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const label = `${completed} of ${total} ${total === 1 ? "drill" : "drills"} practiced`;
  return (
    <div className="space-y-1.5">
      <div
        className="w-full bg-neutral-200 h-2.5 rounded-full border border-black overflow-hidden"
        role="progressbar"
        aria-label="Drills practiced this week"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={label}
      >
        <div className="bg-[#ccff00] h-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs font-bold text-neutral-700" data-testid="plan-progress-label">
        {label}
      </p>
    </div>
  );
}
