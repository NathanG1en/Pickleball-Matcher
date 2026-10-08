"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerSignupAction } from "@/app/actions/player-account";
import { Button } from "@/components/ui/button";

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
  const [password, setPassword] = useState("");
  const [skillLevel, setSkillLevel] = useState<keyof typeof ratings>("intermediate");
  const [customRating, setCustomRating] = useState(false);
  const [initialRating, setInitialRating] = useState(1_000);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await playerSignupAction({ username, name, password, skillLevel, customRating, initialRating });
    if (result.ok) {
      router.push("/players/groups");
      router.refresh();
      return;
    }
    setError(result.error);
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {error && <div role="alert" className="rounded-xl border-2 border-black bg-[#ff6b6b] p-3 text-sm font-black">{error}</div>}
      <Field label="Username" id="player-username">
        <input id="player-username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Letters, numbers, underscores" className={inputClass} />
      </Field>
      <Field label="Display name" id="player-name">
        <input id="player-name" required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name shown to your groups" className={inputClass} />
      </Field>
      <Field label="Password" id="player-password">
        <input id="player-password" required minLength={10} maxLength={72} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        <p className="mt-1 text-xs font-semibold text-neutral-600">At least 10 characters.</p>
      </Field>
      <Field label="Starting skill level" id="player-skill">
        <select id="player-skill" value={skillLevel} onChange={(event) => { const level = event.target.value as keyof typeof ratings; setSkillLevel(level); if (!customRating) setInitialRating(ratings[level]); }} className={inputClass}>
          <option value="beginner">Beginner — developing consistency (900)</option>
          <option value="intermediate">Intermediate — rallies and basic shot choices (1,000)</option>
          <option value="advanced">Advanced — consistent control and strategy (1,100)</option>
        </select>
        <p aria-live="polite" className="mt-1.5 text-xs font-semibold leading-relaxed text-neutral-600">{skillDescriptions[skillLevel]}</p>
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold text-black">
        <input type="checkbox" checked={customRating} onChange={(event) => { setCustomRating(event.target.checked); if (!event.target.checked) setInitialRating(ratings[skillLevel]); }} className="h-4 w-4 accent-black" />
        Enter my own starting rating
      </label>
      {customRating && (
        <Field label="Starting rating (internal scale)" id="custom-rating">
          <input id="custom-rating" type="number" required min={100} max={3000} step={1} value={initialRating} onChange={(event) => setInitialRating(Number(event.target.value))} className={inputClass} />
        </Field>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending || !username.trim() || !name.trim() || password.length < 10} className="w-full font-display text-lg uppercase">
        {pending ? "Creating account…" : "Sign Up"}
      </Button>
      <p className="text-center text-sm font-bold text-neutral-700">Already have an account? <Link href="/player-login" className="underline">Sign in</Link></p>
    </form>
  );
}

const inputClass = "w-full rounded-xl border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:shadow-[5px_5px_0px_0px_#000]";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-xs font-black uppercase tracking-wider">{label}</label>{children}</div>;
}
