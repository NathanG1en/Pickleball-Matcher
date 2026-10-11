"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerSignupAction } from "@/app/actions/player-account";
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  VisibilityToggle,
} from "@/components/ui";

const emptySubscribe = () => () => {};

const ratings = { beginner: 900, intermediate: 1_000, advanced: 1_100 } as const;
const skillDescriptions = {
  beginner: "You know the basic rules and can serve and return, but placement and rally consistency are still developing. Dinks and third-shot drops or drives are not reliable yet.",
  intermediate: "You can sustain rallies, use dinks and volleys, and move toward the kitchen line. You are developing control and learning when to drive or drop the third shot.",
  advanced: "You consistently control pace and placement, use dinks, resets, volleys, and third-shot drops or drives deliberately, and adjust strategy to opponents.",
} as const;

export function PlayerSignupForm() {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
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
    <form onSubmit={submit} noValidate className="space-y-4 text-left" data-hydrated={mounted ? "true" : undefined}>
      {error && Object.values(fieldErrors).every((messages) => messages.length === 0) && error !== "Please check your player details and try again." && (
        <Alert variant="danger-soft" size="md">
          {error}
        </Alert>
      )}

      <FormField
        id="player-username"
        label="Username"
        error={fieldErrors.username?.[0]}
      >
        <Input
          id="player-username"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Letters, numbers, underscores"
          hasError={Boolean(fieldErrors.username?.length)}
          aria-describedby={fieldErrors.username?.length ? "player-username-error" : undefined}
        />
      </FormField>

      <FormField
        id="player-name"
        label="Display name"
        error={fieldErrors.name?.[0]}
      >
        <Input
          id="player-name"
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name shown to your groups"
          hasError={Boolean(fieldErrors.name?.length)}
          aria-describedby={fieldErrors.name?.length ? "player-name-error" : undefined}
        />
      </FormField>

      <FormField
        id="player-gender"
        label="Gender"
        error={fieldErrors.gender?.[0]}
      >
        <Select
          id="player-gender"
          required
          value={gender}
          onChange={(event) => setGender(event.target.value as "male" | "female")}
          hasError={Boolean(fieldErrors.gender?.length)}
          aria-describedby={fieldErrors.gender?.length ? "player-gender-error" : undefined}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>
      </FormField>

      <FormField
        id="player-password"
        label="Password"
        hint="At least 10 characters."
        error={fieldErrors.password?.[0]}
      >
        <div className="relative">
          <Input
            id="player-password"
            required
            minLength={10}
            maxLength={72}
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hasError={Boolean(fieldErrors.password?.length)}
            aria-describedby={fieldErrors.password?.length ? "player-password-error" : "player-password-hint"}
            className="pr-14"
          />
          <VisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((visible) => !visible)}
            label="password"
          />
        </div>
      </FormField>

      <FormField
        id="player-skill"
        label="Starting skill level"
        error={fieldErrors.skillLevel?.[0]}
      >
        <Select
          id="player-skill"
          value={skillLevel}
          onChange={(event) => {
            const level = event.target.value as keyof typeof ratings;
            setSkillLevel(level);
            if (!customRating) setInitialRating(ratings[level]);
          }}
          hasError={Boolean(fieldErrors.skillLevel?.length)}
          aria-describedby={fieldErrors.skillLevel?.length ? "player-skill-error" : undefined}
        >
          <option value="beginner">Beginner — developing consistency (900)</option>
          <option value="intermediate">Intermediate — rallies and basic shot choices (1,000)</option>
          <option value="advanced">Advanced — consistent control and strategy (1,100)</option>
        </Select>
        <p aria-live="polite" className="mt-1.5 text-xs font-semibold leading-relaxed text-neutral-600">
          {skillDescriptions[skillLevel]}
        </p>
      </FormField>

      <label className="flex items-center gap-2 text-sm font-bold text-black">
        <input
          type="checkbox"
          checked={customRating}
          onChange={(event) => {
            setCustomRating(event.target.checked);
            if (!event.target.checked) setInitialRating(ratings[skillLevel]);
          }}
          className="h-4 w-4 accent-black"
        />
        Enter my own starting rating
      </label>

      {customRating && (
        <FormField
          id="custom-rating"
          label="Starting rating (internal scale)"
          error={fieldErrors.initialRating?.[0]}
        >
          <Input
            id="custom-rating"
            type="number"
            required
            min={100}
            max={3000}
            step={1}
            value={initialRating}
            onChange={(event) => setInitialRating(Number(event.target.value))}
            hasError={Boolean(fieldErrors.initialRating?.length)}
            aria-describedby={fieldErrors.initialRating?.length ? "custom-rating-error" : undefined}
          />
        </FormField>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending}
        className="w-full font-display text-lg uppercase"
      >
        {pending ? "Creating account…" : "Sign Up"}
      </Button>

      <p className="text-center text-sm font-bold text-neutral-700">
        Already have an account?{" "}
        <Link
          href="/player-login"
          onClick={(event) => {
            const next = getReturnPath();
            if (next) {
              event.preventDefault();
              router.push(`/player-login?next=${encodeURIComponent(next)}`);
            }
          }}
          className="underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
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
