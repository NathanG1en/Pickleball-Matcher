"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { ChallengeCard, type ChallengeCardProps } from "@/components/training/challenge-card";

export interface DrillLibraryCategory {
  readonly key: string;
  readonly label: string;
}

export type DrillLibraryItem = Omit<ChallengeCardProps, "activeCategory" | "onCategorySelect">;

export interface DrillLibraryProps {
  /** Filter pills, starting with the "all" option. */
  readonly categories: readonly DrillLibraryCategory[];
  readonly items: readonly DrillLibraryItem[];
  /** Label used in the empty state, e.g. "this week's plan" or "the drill library". */
  readonly scopeLabel: string;
}

/**
 * Drill cards with category filters applied in the browser. The active category lives in
 * `?category=` (updated with history.replaceState), so filtering never re-renders the page
 * on the server and open loggers keep their state while switching filters.
 */
export function DrillLibrary({ categories, items, scopeLabel }: DrillLibraryProps) {
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") ?? "all";

  const selectCategory = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("category");
    } else {
      params.set("category", key);
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const toggleCategory = (key: string) => selectCategory(activeCategory === key ? "all" : key);

  const isVisible = (item: DrillLibraryItem) =>
    activeCategory === "all" || item.challenge.skillCategory === activeCategory;
  const visibleCount = items.filter(isVisible).length;
  const activeLabel = categories.find((c) => c.key === activeCategory)?.label ?? activeCategory;

  return (
    <>
      {/* Category Filter Pills - all visible without horizontal scrolling */}
      {categories.length > 1 && (
        <div data-testid="drill-filters" role="group" aria-label="Filter drills by category" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                aria-pressed={isActive}
                data-active={isActive ? "true" : "false"}
                onClick={() => selectCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl min-h-[38px] flex items-center justify-center text-xs font-black uppercase transition-all border-2 select-none cursor-pointer touch-manipulation active:translate-x-[1px] active:translate-y-[1px] ${
                  isActive
                    ? "bg-black text-[#ccff00] border-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white hover:bg-neutral-100 text-neutral-800 border-black shadow-[2px_2px_0px_0px_#000]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Challenge Cards Grid: every card stays mounted; filtering only hides cards. */}
      {items.length > 0 && (
        <section
          id="drill-library"
          aria-live="polite"
          className={`grid sm:grid-cols-2 gap-4 sm:gap-5 scroll-mt-6 ${visibleCount === 0 ? "hidden" : ""}`}
        >
          {items.map((item) => (
            <div key={item.challenge.id} hidden={!isVisible(item)} className="min-w-0 [&>*]:h-full">
              <ChallengeCard {...item} activeCategory={activeCategory} onCategorySelect={toggleCategory} />
            </div>
          ))}
        </section>
      )}

      {items.length > 0 && visibleCount === 0 && (
        <div className="bg-[#FFFDF7] border-2 border-black rounded-2xl p-6 text-center text-sm font-bold text-neutral-600 shadow-[2px_2px_0px_0px_#000]">
          No {activeLabel} drills in {scopeLabel}.
          <div className="mt-3">
            <button
              type="button"
              onClick={() => selectCategory("all")}
              className="inline-block px-3.5 py-1.5 rounded-xl bg-black text-[#ccff00] font-display text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              {categories[0]?.label ?? "Show all"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
