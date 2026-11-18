"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { completeGoogleSignupAction } from "@/app/actions/player-account";
import { duprToElo } from "@/lib/domain/rating-display";
import { Alert, Button, FormField, Input, RatingSlider } from "@/components/ui";

const emptySubscribe = () => () => {};
const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

/**
 * The few things Google can't tell us. Gender has no default: tournament divisions depend on it, so
 * the player picks it on purpose.
 */
export function FinishGoogleSignupForm({
  suggestedUsername,
  suggestedName,
  next,
}: {
  suggestedUsername: string;
  suggestedName: string;
  next?: string;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [username, setUsername] = useState(suggestedUsername);
  const [name, setName] = useState(suggestedName);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [rating, setRating] = useState(3.5);
  const [customRating, setCustomRating] = useState(false);
  const [customDuprInput, setCustomDuprInput] = useState("3.5");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!gender) {
      setFieldErrors({ gender: ["Choose male or female."] });
      return;
    }
    const dupr = customRating ? Number(customDuprInput) : rating;
    if (customRating && (!customDuprInput.trim() || !Number.isFinite(dupr) || dupr < 2 || dupr > 8)) {
      setFieldErrors({ initialRating: ["Enter a rating between 2.0 and 8.0."] });
      return;
    }

    setPending(true);
    const result = await completeGoogleSignupAction({
      username,
      name,
      gender,
      skillLevel: dupr < 3.0 ? "beginner" : dupr < 4.0 ? "intermediate" : "advanced",
      initialRating: duprToElo(dupr),
    });
    if (result.ok) {
      router.push(next ?? "/players/groups");
      router.refresh();
      return;
    }
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
    setPending(false);
  };

  const hasFieldErrors = Object.values(fieldErrors).some((messages) => messages?.length);

  return (
    <form onSubmit={submit} noValidate className="space-y-4 text-left" data-hydrated={mounted ? "true" : undefined}>
      {error && !hasFieldErrors && (
        <Alert variant="danger-soft" size="md">
          {error}
        </Alert>
      )}

      <FormField id="finish-username" label="Username" error={fieldErrors.username?.[0]}>
        <Input
          id="finish-username"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Letters, numbers, underscores"
          hasError={Boolean(fieldErrors.username?.length)}
          aria-describedby={fieldErrors.username?.length ? "finish-username-error" : undefined}
        />
      </FormField>

      <FormField id="finish-name" label="Display name" error={fieldErrors.name?.[0]}>
        <Input
          id="finish-name"
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name shown to your groups"
          hasError={Boolean(fieldErrors.name?.length)}
          aria-describedby={fieldErrors.name?.length ? "finish-name-error" : undefined}
        />
      </FormField>

      <fieldset className="space-y-1.5" aria-describedby={fieldErrors.gender?.length ? "finish-gender-error" : undefined}>
        <legend className="mb-1.5 block text-xs font-black uppercase tracking-wider text-black">Gender</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gender">
          {GENDERS.map((option) => {
            const selected = gender === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`finish-gender-${option.value}`}
                onClick={() => setGender(option.value)}
                className={`min-h-11 rounded-xl border-2 border-black px-3 font-display text-base font-black uppercase text-black transition-[transform,box-shadow,background-color] ${
                  selected ? "bg-[#ccff00] shadow-[3px_3px_0px_0px_#000] -translate-y-0.5" : "bg-white hover:bg-neutral-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs font-bold text-neutral-600">Used for mixed and gendered tournament divisions.</p>
        {fieldErrors.gender?.[0] && (
          <p id="finish-gender-error" role="alert" className="text-xs font-bold text-red-600">
            {fieldErrors.gender[0]}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <RatingSlider
          id="finish-skill"
          label="Starting skill level"
          value={rating}
          onChange={(value) => {
            setRating(value);
            if (!customRating) setCustomDuprInput(String(value));
          }}
          disabled={customRating}
          dataTestId="finish-skill-slider"
          showDescription={!customRating}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-bold text-black">
        <input
          type="checkbox"
          checked={customRating}
          onChange={(event) => {
            setCustomRating(event.target.checked);
            if (!event.target.checked) setCustomDuprInput(String(rating));
          }}
          className="h-4 w-4 accent-black"
        />
        I know my exact rating
      </label>

      {customRating && (
        <FormField id="finish-custom-rating" label="Rating (2.0 – 8.0)" error={fieldErrors.initialRating?.[0]}>
          <Input
            id="finish-custom-rating"
            type="number"
            inputMode="decimal"
            required
            min={2.0}
            max={8.0}
            step={0.001}
            value={customDuprInput}
            onChange={(event) => setCustomDuprInput(event.target.value)}
            hasError={Boolean(fieldErrors.initialRating?.length)}
            aria-describedby={fieldErrors.initialRating?.length ? "finish-custom-rating-error" : undefined}
          />
        </FormField>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={pending} className="min-h-11 w-full font-display text-lg uppercase">
        {pending ? "Creating account…" : "Let's play →"}
      </Button>
    </form>
  );
}
