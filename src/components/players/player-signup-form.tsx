"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerSignupAction } from "@/app/actions/player-account";
import { Button } from "@/components/ui/button";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";

const ratings = { beginner: 900, intermediate: 1_000, advanced: 1_100 } as const;
const skillDescriptions = {
  beginner: "You know the basic rules and can serve and return, but placement and rally consistency are still developing. Dinks and third-shot drops or drives are not reliable yet.",
  intermediate: "You can sustain rallies, use dinks and volleys, and move toward the kitchen line. You are developing control and learning when to drive or drop the third shot.",
  advanced: "You consistently control pace and placement, use dinks, resets, volleys, and third-shot drops or drives deliberately, and adjust strategy to opponents.",
} as const;

export function PlayerSignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [skillLevel, setSkillLevel] = useState<keyof typeof ratings>("intermediate");
  const [customRating, setCustomRating] = useState(false);
  const [initialRating, setInitialRating] = useState(1_000);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const result = await playerSignupAction({ username, name, gender, password, skillLevel, customRating, initialRating });
    if (result.ok) {
      router.push(getReturnPath() ?? "/players/groups");
      router.refresh();
      return;
    }
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
    setPending(false);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 text-left">
      {error && Object.values(fieldErrors).every((messages) => messages.length === 0) && error !== "Please check your player details and try again." && <div role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-3 text-sm font-black text-red-700">{error}</div>}
      <Field label="Username" id="player-username">
        <input id="player-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Letters, numbers, underscores" aria-invalid={Boolean(fieldErrors.username?.length)} aria-describedby={fieldErrors.username?.length ? "player-username-error" : undefined} className={fieldErrors.username?.length ? errorInputClass : inputClass} />
        {fieldErrors.username?.[0] && <p id="player-username-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.username[0]}</p>}
      </Field>
      <Field label="Display name" id="player-name">
        <input id="player-name" required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name shown to your groups" aria-invalid={Boolean(fieldErrors.name?.length)} aria-describedby={fieldErrors.name?.length ? "player-name-error" : undefined} className={fieldErrors.name?.length ? errorInputClass : inputClass} />
        {fieldErrors.name?.[0] && <p id="player-name-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.name[0]}</p>}
      </Field>
      <Field label="Gender" id="player-gender">
        <select
          id="player-gender"
          required
          value={gender}
          onChange={(event) => setGender(event.target.value as "male" | "female")}
          aria-invalid={Boolean(fieldErrors.gender?.length)}
          aria-describedby={fieldErrors.gender?.length ? "player-gender-error" : undefined}
          className={fieldErrors.gender?.length ? errorInputClass : inputClass}
        >
          <option value="" disabled>Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        {fieldErrors.gender?.[0] && <p id="player-gender-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.gender[0]}</p>}
      </Field>
      <Field label="Password" id="player-password">
        <div className="relative"><input id="player-password" required minLength={10} maxLength={72} type={passwordVisible ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fieldErrors.password?.length)} aria-describedby={fieldErrors.password?.length ? "player-password-error" : "player-password-hint"} className={`${fieldErrors.password?.length ? errorInputClass : inputClass} pr-14`} /><VisibilityToggle visible={passwordVisible} onToggle={() => setPasswordVisible((visible) => !visible)} label="password" /></div>
        {fieldErrors.password?.[0] ? <p id="player-password-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.password[0]}</p> : <p id="player-password-hint" className="mt-1 text-xs font-semibold text-neutral-600">At least 10 characters.</p>}
      </Field>
      <Field label="Starting skill level" id="player-skill">
        <select id="player-skill" value={skillLevel} onChange={(event) => { const level = event.target.value as keyof typeof ratings; setSkillLevel(level); if (!customRating) setInitialRating(ratings[level]); }} aria-invalid={Boolean(fieldErrors.skillLevel?.length)} aria-describedby={fieldErrors.skillLevel?.length ? "player-skill-error" : undefined} className={fieldErrors.skillLevel?.length ? errorInputClass : inputClass}>
          <option value="beginner">Beginner — developing consistency (900)</option>
          <option value="intermediate">Intermediate — rallies and basic shot choices (1,000)</option>
          <option value="advanced">Advanced — consistent control and strategy (1,100)</option>
        </select>
        {fieldErrors.skillLevel?.[0] && <p id="player-skill-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.skillLevel[0]}</p>}
        <p aria-live="polite" className="mt-1.5 text-xs font-semibold leading-relaxed text-neutral-600">{skillDescriptions[skillLevel]}</p>
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold text-black">
        <input type="checkbox" checked={customRating} onChange={(event) => { setCustomRating(event.target.checked); if (!event.target.checked) setInitialRating(ratings[skillLevel]); }} className="h-4 w-4 accent-black" />
        Enter my own starting rating
      </label>
      {customRating && (
        <Field label="Starting rating (internal scale)" id="custom-rating">
          <input id="custom-rating" type="number" required min={100} max={3000} step={1} value={initialRating} onChange={(event) => setInitialRating(Number(event.target.value))} aria-invalid={Boolean(fieldErrors.initialRating?.length)} aria-describedby={fieldErrors.initialRating?.length ? "custom-rating-error" : undefined} className={fieldErrors.initialRating?.length ? errorInputClass : inputClass} />
          {fieldErrors.initialRating?.[0] && <p id="custom-rating-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.initialRating[0]}</p>}
        </Field>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full font-display text-lg uppercase">
        {pending ? "Creating account…" : "Sign Up"}
      </Button>
      <p className="text-center text-sm font-bold text-neutral-700">Already have an account? <Link href="/player-login" onClick={(event) => { const next = getReturnPath(); if (next) { event.preventDefault(); router.push(`/player-login?next=${encodeURIComponent(next)}`); } }} className="underline">Sign in</Link></p>
    </form>
  );
}

const inputClass = "w-full rounded-xl border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:shadow-[5px_5px_0px_0px_#000]";
const errorInputClass = "w-full rounded-xl border-2 border-red-600 bg-red-50 px-4 py-3 font-bold text-black shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:shadow-[5px_5px_0px_0px_#000]";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-black uppercase tracking-wider">{label}</label>{children}</div>;
}

function getReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested) return null;
  if (requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) {
    return requested;
  }
  return null;
}
