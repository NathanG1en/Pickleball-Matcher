"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerSignupAction } from "@/app/actions/player-account";
import {
  duprToElo,
  getSkillTier,
} from "@/lib/domain/rating-display";
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  VisibilityToggle,
} from "@/components/ui";

const emptySubscribe = () => () => {};

export function PlayerSignupForm() {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("3.5");
  const [customRating, setCustomRating] = useState(false);
  const [customDuprInput, setCustomDuprInput] = useState("3.5");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const activeDupr = customRating
    ? parseFloat(customDuprInput) || 3.5
    : parseFloat(selectedPreset);
  const activeTier = getSkillTier(activeDupr);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const duprValue = customRating ? parseFloat(customDuprInput) : parseFloat(selectedPreset);
    const initialRatingElo = duprToElo(isNaN(duprValue) ? 3.5 : duprValue);
    const skillLevel: "beginner" | "intermediate" | "advanced" =
      duprValue < 3.0 ? "beginner" : duprValue < 4.0 ? "intermediate" : "advanced";

    const result = await playerSignupAction({
      username,
      name,
      gender,
      password,
      skillLevel,
      customRating: true,
      initialRating: initialRatingElo,
    });
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
          value={selectedPreset}
          disabled={customRating}
          onChange={(event) => {
            setSelectedPreset(event.target.value);
            if (!customRating) setCustomDuprInput(event.target.value);
          }}
          hasError={Boolean(fieldErrors.skillLevel?.length)}
          aria-describedby={fieldErrors.skillLevel?.length ? "player-skill-error" : undefined}
        >
          <option value="2.0">Beginner Level (2.0 – 2.499)</option>
          <option value="2.5">Advanced Beginner Level (2.5 – 2.999)</option>
          <option value="3.0">Intermediate Level (3.0 – 3.499)</option>
          <option value="3.5">Advanced Intermediate Level (3.5 – 3.999)</option>
          <option value="4.0">Competitive Level (4.0 – 4.499)</option>
          <option value="4.5">Advanced Competitive Level (4.5 – 4.999)</option>
        </Select>
        <p aria-live="polite" className="mt-1.5 text-xs font-semibold leading-relaxed text-neutral-600">
          {activeTier.description}
        </p>
      </FormField>

      <label className="flex items-center gap-2 text-sm font-bold text-black">
        <input
          type="checkbox"
          checked={customRating}
          onChange={(event) => {
            setCustomRating(event.target.checked);
            if (!event.target.checked) setCustomDuprInput(selectedPreset);
          }}
          className="h-4 w-4 accent-black"
        />
        Enter custom rating (e.g. 5.0+ or specific rating)
      </label>

      {customRating && (
        <FormField
          id="custom-rating"
          label="Custom rating (2.0 – 8.0)"
          error={fieldErrors.initialRating?.[0]}
        >
          <Input
            id="custom-rating"
            type="number"
            required
            min={2.0}
            max={8.0}
            step={0.001}
            value={customDuprInput}
            onChange={(event) => setCustomDuprInput(event.target.value)}
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
