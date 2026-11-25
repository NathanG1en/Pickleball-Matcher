import React from "react";
import type { ChallengeTemplateRecord, TrainingResultRecord } from "@/lib/domain/types";
import { formatResultHeadline, formatLastResultValue } from "@/lib/domain/training-history";
import { ClientDate, ClientTime } from "@/components/ui/client-date-time";
import { ChevronDownIcon } from "@/components/ui/icons";
import { DeleteAttemptButton } from "@/components/training/drill-history-client";
import { MedalRays, PickleballMedal } from "@/components/training/pickleball-medal";

export interface PersonalBestsProps {
  readonly challenge: ChallengeTemplateRecord;
  /** Best results first (see rankPersonalBests), at most three. */
  readonly ranked: readonly TrainingResultRecord[];
  /** Ids of results the viewer logged themselves and may delete. */
  readonly ownResultIds: readonly string[];
  readonly groupId?: string | null;
}

function AttemptDetails({
  challenge,
  result,
  canDelete,
  groupId,
}: {
  readonly challenge: ChallengeTemplateRecord;
  readonly result: TrainingResultRecord;
  readonly canDelete: boolean;
  readonly groupId?: string | null;
}) {
  const value = formatLastResultValue(challenge, {
    scorePrimary: result.scorePrimary,
    scoreSecondary: result.scoreSecondary ?? null,
    metricValue: result.metricValue,
  });
  return (
    <div className="mt-4 border-t-2 border-black/10 pt-4 space-y-3">
      <div className="space-y-0.5">
        {result.notes && <p className="text-base font-black text-black">{result.notes}</p>}
        <p className="text-sm font-medium text-neutral-600">
          <ClientDate date={result.recordedAt} options={{ weekday: "short", month: "short", day: "numeric", year: "numeric" }} />
          {" at "}
          <ClientTime date={result.recordedAt} />
        </p>
      </div>
      {canDelete && (
        <div className="flex justify-end">
          <DeleteAttemptButton
            resultId={result.id}
            challengeId={challenge.id}
            groupId={groupId ?? null}
            attemptLabel={value}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Podium of the player's top three results for a drill: the personal best open with a
 * pickleball "PB" medal, the 2nd and 3rd best as collapsible rows.
 */
export function PersonalBests({ challenge, ranked, ownResultIds, groupId }: PersonalBestsProps) {
  if (ranked.length === 0) return null;
  const own = new Set(ownResultIds);

  return (
    <section
      data-testid="personal-bests"
      aria-labelledby="personal-bests-heading"
      className="overflow-hidden rounded-3xl border-[3px] border-black bg-[#FFFDF7] shadow-[4px_4px_0px_0px_#000]"
    >
      <h2 id="personal-bests-heading" className="px-5 pt-5 font-display text-lg font-black uppercase text-black">
        Personal Bests
      </h2>

      <ol>
        {ranked.map((result, index) => {
          const rank = (index + 1) as 1 | 2 | 3;
          const { value, detail } = formatResultHeadline(challenge, result);
          const isBest = rank === 1;
          return (
            <li key={result.id} className={isBest ? "" : "border-t-2 border-black/10"}>
              <details open={isBest} className="group/pb" data-testid={`personal-best-${rank}`}>
                <summary
                  className={`relative flex cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden ${
                    isBest ? "flex-col items-center px-5 pb-1 pt-2 text-center" : "items-center gap-4 px-5 py-4"
                  }`}
                >
                  {isBest ? (
                    <>
                      <div className="relative flex h-[120px] w-[240px] items-center justify-center">
                        <MedalRays className="absolute inset-0 h-full w-full" />
                        <PickleballMedal rank={1} size={96} className="relative" />
                      </div>
                      <span className="mt-2 font-display text-[40px] font-black leading-none tabular-nums text-black">{value}</span>
                      <span className="mt-1 text-lg font-medium text-neutral-600">{detail}</span>
                    </>
                  ) : (
                    <>
                      <PickleballMedal rank={rank} size={52} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-2xl font-black leading-none tabular-nums text-black">{value}</span>
                        <span className="mt-1 block text-sm font-medium text-neutral-600">{detail}</span>
                      </span>
                    </>
                  )}
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-700 ${
                      isBest ? "absolute right-3 top-0" : ""
                    }`}
                  >
                    <ChevronDownIcon className="h-5 w-5 transition-transform group-open/pb:rotate-180" />
                    <span className="sr-only">Show or hide details for the {isBest ? "personal best" : `${rank === 2 ? "2nd" : "3rd"} best`}</span>
                  </span>
                </summary>
                <div className="px-5 pb-5">
                  <AttemptDetails
                    challenge={challenge}
                    result={result}
                    canDelete={own.has(result.id)}
                    groupId={groupId}
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
