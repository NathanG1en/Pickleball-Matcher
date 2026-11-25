import React from "react";
import Link from "next/link";
import { getActionRepository } from "@/app/actions/action-context";
import {
  PRACTICE_PROFILE_WINDOW_DAYS,
  computePracticeProfile,
  getPracticeProfileState,
  toPercentOfTarget,
  type PracticeProfile,
  type PracticeSkillScore,
} from "@/lib/domain/practice-profile";
import { formatDaysAgo } from "@/lib/domain/training-history";
import { ArrowRightIcon, ChevronDownIcon } from "@/components/ui/icons";
import { PracticeProfileDisclosure } from "@/components/players/practice-profile-disclosure";
import { HomePickleball } from "@/components/home/home-pickleball";

const trainingHref = (key: string) => `/training?category=${key}`;

// Hexagon geometry (SVG user units).
const W = 372; // wide enough that side labels like "THIRD SHOT" never clip
const H = 268;
const CX = W / 2;
const CY = 132;
const R = 88;

function axisPoint(index: number, radius: number) {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function ringPath(fraction: number) {
  return (
    Array.from({ length: 6 }, (_, i) => axisPoint(i, R * fraction))
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ") + " Z"
  );
}

function SkillHexagon({ skills }: { readonly skills: readonly PracticeSkillScore[] }) {
  const tested = skills
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.score !== null)
    .map(({ s, i }) => ({ skill: s, index: i, ...axisPoint(i, R * Math.max(0.06, s.score ?? 0)) }));

  const summary = skills
    .map((s) => `${s.label} ${s.score === null ? "not tested" : `${toPercentOfTarget(s.score)}% of target`}`)
    .join(", ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[372px] h-auto mx-auto" role="img" aria-label={`Practice profile: ${summary}.`}>
      {/* Rings at 50% and 100% of target */}
      <path className="practice-profile-ring" d={ringPath(1)} pathLength={1} strokeDasharray="1" fill="#f5f5f0" stroke="#000" strokeWidth="2" />
      <path d={ringPath(0.5)} fill="none" stroke="#d4d4d4" strokeWidth="1.5" />

      {/* Spokes: solid for tested skills, dashed for untested */}
      {skills.map((s, i) => {
        const end = axisPoint(i, R);
        return (
          <line
            key={s.key}
            x1={CX}
            y1={CY}
            x2={end.x}
            y2={end.y}
            stroke={s.score === null ? "#a3a3a3" : "#d4d4d4"}
            strokeWidth="1.5"
            strokeDasharray={s.score === null ? "3 4" : undefined}
          />
        );
      })}

      {/* Shape through tested skills only (needs three to form an area) */}
      {tested.length >= 3 && (
        <polygon
          className="practice-profile-shape"
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          points={tested.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="#ccff00"
          fillOpacity="0.75"
          stroke="#000"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {tested.map((p) => (
        <circle
          key={p.skill.key}
          className="practice-profile-dot"
          style={{ "--practice-i": p.index } as React.CSSProperties}
          cx={p.x}
          cy={p.y}
          r="5"
          fill={p.skill.lowConfidence ? "#fff" : "#ccff00"}
          stroke="#000"
          strokeWidth="2"
        />
      ))}

      {/* Axis labels link to the matching drills */}
      {skills.map((s, i) => {
        const p = axisPoint(i, R + 24);
        const anchor = Math.abs(p.x - CX) < 4 ? "middle" : p.x > CX ? "start" : "end";
        const top = p.y < CY - R; // top label: value under name
        const bottom = p.y > CY + R; // bottom label
        const nameY = top ? p.y - 10 : bottom ? p.y + 2 : p.y - 3;
        return (
          <a
            key={s.key}
            href={trainingHref(s.key)}
            aria-label={`Practice ${s.label}`}
            className="practice-profile-label"
            style={{ "--practice-i": i } as React.CSSProperties}
          >
            <text x={p.x} y={nameY} textAnchor={anchor} fontSize="12" fontWeight="800" className="fill-black uppercase" style={{ letterSpacing: "0.04em" }}>
              {s.label.toUpperCase()}
            </text>
            <text x={p.x} y={nameY + 15} textAnchor={anchor} fontSize="12" fontWeight="700" className={s.score === null ? "fill-neutral-400" : "fill-neutral-600"}>
              {s.score === null ? "Not tested" : `${toPercentOfTarget(s.score)}%`}
            </text>
          </a>
        );
      })}
    </svg>
  );
}

function FocusSuggestion({ profile }: { readonly profile: PracticeProfile }) {
  const untested = profile.skills.find((s) => s.score === null);
  let title: string;
  let detail: string;
  let href: string;
  let cta: string;

  const state = getPracticeProfileState(profile);

  if (state === "never") {
    title = "Start your practice profile";
    detail = "Log any drill with a target to see where each skill stands.";
    href = "/training";
    cta = "Go to Training";
  } else if (state === "stale") {
    title = `Nothing scored in the last ${PRACTICE_PROFILE_WINDOW_DAYS} days`;
    detail = "Log a drill to refresh your profile.";
    href = "/training";
    cta = "Go to Training";
  } else if (state === "unscored") {
    title = "No scored drills yet";
    detail = "Win-based games aren't scored. Log a drill with a target to score your skills.";
    href = "/training";
    cta = "Go to Training";
  } else if (profile.weakest && (profile.weakest.score ?? 1) < 1) {
    title = `Focus next: ${profile.weakest.label}`;
    detail = `${toPercentOfTarget(profile.weakest.score ?? 0)}% of target, your lowest tested skill.`;
    href = trainingHref(profile.weakest.key);
    cta = `Practice ${profile.weakest.label}`;
  } else if (untested) {
    title = `Try ${untested.label} next`;
    detail = "Every tested skill is at target. This one hasn't been tested yet.";
    href = trainingHref(untested.key);
    cta = `Practice ${untested.label}`;
  } else {
    return (
      <p className="practice-profile-focus rounded-2xl border-2 border-black bg-[#ccff00] px-4 py-3 text-sm font-bold text-black">
        Every skill is at target. Raise the bar with harder goals in your weekly plan.
      </p>
    );
  }

  return (
    <div
      data-testid="practice-focus"
      className={`practice-profile-focus flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black px-4 py-3 ${
        // Getting-started prompts use the cream card so the lime pickleball stands out beside the button.
        href === "/training" ? "bg-white" : "bg-[#ccff00]"
      }`}
    >
      <div className="min-w-0">
        <p className="font-display text-base font-black uppercase leading-tight text-black">{title}</p>
        <p className="text-xs font-bold text-neutral-800">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={href}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-black bg-white px-3 font-display text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
        >
          {cta}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
        {href === "/training" && (
          // The home screen's pickleball drops in and settles beside "Go to Training".
          // Layers: hop (vertical fall/bounces) > roll (sideways slide) > spin (rotation only),
          // so rotation never bends the fall.
          <span className="practice-profile-ball-hop inline-flex" data-testid="practice-profile-ball">
            <span className="practice-profile-ball-roll inline-flex">
              <span className="practice-profile-ball-spin inline-flex">
                <HomePickleball playOnMount={false} />
              </span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function SkillRow({ skill, index }: { readonly skill: PracticeSkillScore; readonly index: number }) {
  const percent = skill.score === null ? null : toPercentOfTarget(skill.score);
  const detail =
    skill.score === null
      ? "Not tested yet"
      : `${skill.drillsTried} ${skill.drillsTried === 1 ? "drill" : "drills"} · ${skill.attempts} ${skill.attempts === 1 ? "attempt" : "attempts"}${
          skill.lowConfidence ? " · early estimate" : ""
        }`;
  return (
    <li>
      <Link
        href={trainingHref(skill.key)}
        data-testid={`practice-skill-${skill.key}`}
        className="group flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-neutral-100"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-black text-black">{skill.label}</span>
            <span className={`text-sm font-bold tabular-nums ${percent === null ? "text-neutral-400" : "text-black"}`}>
              {percent === null ? "—" : `${percent}%`}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-black bg-neutral-100">
            {percent !== null && (
              <div
                className="practice-profile-bar h-full bg-[#ccff00]"
                style={{ width: `${Math.max(3, percent)}%`, "--practice-i": index } as React.CSSProperties}
              />
            )}
          </div>
          <span className="mt-0.5 block text-[11px] font-bold text-neutral-500">{detail}</span>
        </div>
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-black" />
      </Link>
    </li>
  );
}

function collapsedSummary(profile: PracticeProfile): string {
  const state = getPracticeProfileState(profile);
  if (state === "never") return "No skills tested yet";
  if (state === "stale") return `Nothing scored in the last ${PRACTICE_PROFILE_WINDOW_DAYS} days`;
  if (state === "unscored") return "No scored drills yet";
  const tested = `${profile.testedCount} of ${profile.skills.length} skills tested`;
  if (profile.weakest && (profile.weakest.score ?? 1) < 1) {
    return `${tested} · Focus: ${profile.weakest.label} ${toPercentOfTarget(profile.weakest.score ?? 0)}%`;
  }
  return tested;
}

/** Collapsible card (closed by default); load data with loadPracticeProfile. */
export function PracticeProfileCard({ profile }: { readonly profile: PracticeProfile }) {
  return (
    <PracticeProfileDisclosure
      data-testid="practice-profile"
      className="practice-profile group/practice rounded-3xl border-[3px] border-black bg-[#FFFDF7]"
    >
      <summary data-testid="practice-profile-toggle" className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl p-5 select-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-black uppercase leading-tight text-black">Practice Profile</h2>
          <p data-testid="practice-profile-summary" className="mt-0.5 truncate text-xs font-bold text-neutral-600">
            {collapsedSummary(profile)}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
          <ChevronDownIcon className="h-4 w-4 transition-transform group-open/practice:rotate-180" />
          <span className="sr-only">Show or hide practice profile</span>
        </span>
      </summary>

      <div className="practice-profile-body space-y-4 px-5 pb-5">
        <p className="text-xs font-bold text-neutral-600">
          Best drill results in the last {PRACTICE_PROFILE_WINDOW_DAYS} days, as a % of each drill&apos;s target.
        </p>

        <SkillHexagon skills={profile.skills} />

        <FocusSuggestion profile={profile} />

        <ul className="space-y-1">
          {profile.skills.map((skill, index) => (
            <SkillRow key={skill.key} skill={skill} index={index} />
          ))}
        </ul>

        <p className="text-xs font-bold text-neutral-500">
          {profile.daysSinceLastPractice === null
            ? "No drills logged yet."
            : `Last practiced ${formatDaysAgo(profile.daysSinceLastPractice)}.`}{" "}
          Win-based drills aren&apos;t counted because results depend on your opponent.
        </p>
      </div>
    </PracticeProfileDisclosure>
  );
}

/** Loads the signed-in player's recent training results and computes their practice profile. */
export async function loadPracticeProfile(accountId: string): Promise<PracticeProfile> {
  const repo = getActionRepository();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (PRACTICE_PROFILE_WINDOW_DAYS - 1));

  const [results, challenges, latest] = await Promise.all([
    repo.listAccountTrainingResultsSince(accountId, since),
    repo.listChallengeTemplates(),
    repo.getPlayerLatestTrainingResults(accountId),
  ]);
  const lastPracticedAt = [...latest.values()].reduce<Date | null>(
    (max, r) => (!max || r.recordedAt > max ? r.recordedAt : max),
    null,
  );
  return computePracticeProfile({ results, challenges, lastPracticedAt });
}
