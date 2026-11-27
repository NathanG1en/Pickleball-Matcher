"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishWeeklyPlanAction } from "@/app/actions/training";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";
import { formatWeekOf, getWeekNumberFromDate } from "@/lib/domain/training-calculator";
import { CheckIcon, SearchIcon, XIcon } from "@/components/ui/icons";

export interface NewPlanFormProps {
  readonly groupId: string;
  readonly challenges: readonly ChallengeTemplateRecord[];
  readonly defaultWeekNumber: number;
  readonly defaultYear: number;
}

export function NewPlanForm({
  groupId,
  challenges,
  defaultWeekNumber,
  defaultYear,
}: NewPlanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [weekNumber, setWeekNumber] = useState(defaultWeekNumber);
  const [year, setYear] = useState(defaultYear);
  const [title, setTitle] = useState(
    `Week of ${formatWeekOf(defaultYear, defaultWeekNumber)} Challenge Plan`,
  );

  const weekOptions = React.useMemo(() => {
    const options: Array<{ year: number; weekNumber: number; label: string }> = [];
    const baseDate = new Date();
    for (let offset = -1; offset <= 4; offset++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + offset * 7);
      const { year: y, weekNumber: w } = getWeekNumberFromDate(d);
      const dateStr = formatWeekOf(y, w);
      let suffix = "";
      if (offset === 0) suffix = " (Current Week)";
      else if (offset === 1) suffix = " (Next Week)";
      else if (offset === -1) suffix = " (Last Week)";
      options.push({ year: y, weekNumber: w, label: `${dateStr}${suffix}` });
    }
    return options;
  }, []);
  const [focusNotes, setFocusNotes] = useState("");
  const eligibleChallenges = React.useMemo(
    () => challenges.filter((c) => c.participantFormat !== "individual"),
    [challenges],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return eligibleChallenges.slice(0, 3).map((c) => c.id);
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categoryLabels: Record<string, string> = {
    dinking: "Dinking",
    third_shot: "Third Shot",
    serving: "Serving",
    volleys: "Volleys",
    resets: "Resets",
    conditioning: "Conditioning",
    strategy: "Strategy",
  };

  const categories = [
    { key: "all", label: "All Drills" },
    { key: "dinking", label: "Dinking" },
    { key: "third_shot", label: "Third Shot" },
    { key: "serving", label: "Serving" },
    { key: "volleys", label: "Volleys" },
    { key: "resets", label: "Resets" },
    { key: "conditioning", label: "Conditioning" },
    { key: "strategy", label: "Strategy" },
  ];

  const visibleChallenges = eligibleChallenges.filter((c) => {
    if (selectedCategory !== "all" && c.skillCategory !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const catLabel = (categoryLabels[c.skillCategory] ?? c.skillCategory).toLowerCase();
      const inTitle = c.title.toLowerCase().includes(q);
      const inDesc = c.description.toLowerCase().includes(q);
      const inCat = catLabel.includes(q);
      if (!inTitle && !inDesc && !inCat) return false;
    }
    return true;
  });

  const toggleChallenge = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError("Please select at least 1 challenge.");
      return;
    }

    startTransition(async () => {
      const res = await publishWeeklyPlanAction({
        groupId,
        year,
        weekNumber,
        title,
        focusNotes: focusNotes.trim() ? focusNotes.trim() : null,
        challengeIds: selectedIds,
      });

      if (res.ok) {
        router.push(`/g/${groupId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-rose-100 text-rose-900 border-2 border-rose-500 font-bold text-xs">
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
            <label htmlFor="plan-title" className="block text-xs font-bold text-neutral-700 mb-1">
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
            <label htmlFor="target-week" className="block text-xs font-bold text-neutral-700 mb-1">
              Target Week
            </label>
            <select
              id="target-week"
              value={`${year}-${weekNumber}`}
              onChange={(e) => {
                const [y, w] = e.target.value.split("-").map(Number);
                setYear(y);
                setWeekNumber(w);
                setTitle(`Week of ${formatWeekOf(y, w)} Challenge Plan`);
              }}
              className="w-full h-11 sm:h-12 px-3 text-base font-bold rounded-xl border-2 border-black bg-white focus:outline-none focus:bg-[#FFFDF7]"
            >
              {weekOptions.map((opt) => (
                <option key={`${opt.year}-${opt.weekNumber}`} value={`${opt.year}-${opt.weekNumber}`}>
                  Week of {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="focus-notes" className="block text-xs font-bold text-neutral-700 mb-1">
            Focus Notes & Tips for Members (Optional)
          </label>
          <textarea
            id="focus-notes"
            rows={2}
            value={focusNotes}
            onChange={(e) => setFocusNotes(e.target.value)}
            placeholder="e.g. Focus on keeping paddle face flat and knees bent on drops."
            className="w-full p-3 text-base font-bold rounded-xl border-2 border-black bg-white focus:outline-none focus:bg-[#FFFDF7]"
          />
        </div>
      </section>

      {/* Challenge Picker Card */}
      <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <h2 className="font-display text-base sm:text-lg font-black uppercase text-black">
            Select Challenges ({selectedIds.length} Selected)
          </h2>
          <span className="text-xs font-bold text-neutral-500">Pick 1 to 6 drills</span>
        </div>

        {/* Search Drills Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <SearchIcon className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drills by name or skill..."
            aria-label="Search drills"
            data-testid="search-drills-input"
            className="w-full pl-9 pr-8 py-2 bg-neutral-50 border-2 border-black rounded-xl text-base sm:text-sm font-bold text-black placeholder-neutral-400 shadow-[2px_2px_0px_0px_#000] focus:bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_#000] transition-shadow"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear drill search"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-black cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const count =
              cat.key === "all"
                ? selectedIds.length
                : selectedIds.filter((id) => {
                    const c = challenges.find((ch) => ch.id === id);
                    return c?.skillCategory === cat.key;
                  }).length;
            const isActive = selectedCategory === cat.key;

            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl min-h-[38px] flex items-center justify-center text-sm font-bold transition-all border-2 select-none active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                  isActive
                    ? "bg-black text-[#ccff00] border-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white hover:bg-neutral-100 text-neutral-800 border-black shadow-[2px_2px_0px_0px_#000]"
                }`}
              >
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                      isActive ? "bg-[#ccff00] text-black" : "bg-black text-[#ccff00]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {visibleChallenges.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-white border-2 border-black space-y-2 shadow-[2px_2px_0px_0px_#000]">
            <p className="text-sm font-bold text-black">No matching drills found</p>
            <p className="text-xs font-medium text-neutral-600">Try adjusting your search terms or category filter.</p>
            {(searchQuery || selectedCategory !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-1 px-3.5 py-1.5 rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8e600] text-black text-sm font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
          {visibleChallenges.map((challenge) => {
            const isSelected = selectedIds.includes(challenge.id);
            return (
              <div
                key={challenge.id}
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
                className={`w-full p-3 sm:p-3.5 rounded-2xl border-2 text-left flex items-start gap-2.5 sm:gap-3 transition-all cursor-pointer touch-manipulation select-none ${
                  isSelected
                    ? "bg-[#ccff00]/20 border-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white border-black/30 hover:border-black active:bg-neutral-50"
                }`}
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
                    <span className="text-sm font-bold text-black">
                      {challenge.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategory((prev) =>
                          prev === challenge.skillCategory ? "all" : challenge.skillCategory,
                        );
                      }}
                      className={`px-2 py-0.5 rounded-lg text-xs sm:text-xs font-bold transition-colors border select-none cursor-pointer ${
                        selectedCategory === challenge.skillCategory
                          ? "bg-black text-[#ccff00] border-black shadow-[1px_1px_0px_0px_#000]"
                          : "bg-black hover:bg-neutral-800 text-[#ccff00] border-black"
                      }`}
                      title={
                        selectedCategory === challenge.skillCategory
                          ? "Clear filter (showing all)"
                          : `Filter by ${categoryLabels[challenge.skillCategory] ?? challenge.skillCategory}`
                      }
                    >
                      {categoryLabels[challenge.skillCategory] ?? challenge.skillCategory}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-600 line-clamp-2">
                    {challenge.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isPending || selectedIds.length === 0}
          className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black text-sm sm:text-base font-bold shadow-[4px_4px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:cursor-not-allowed disabled:shadow-none disabled:bg-neutral-200 disabled:text-neutral-600 disabled:border-neutral-400 disabled:hover:bg-neutral-200 touch-manipulation select-none"
        >
          {isPending ? "Publishing Plan..." : "Publish Weekly Plan →"}
        </button>
      </div>
    </form>
  );
}

