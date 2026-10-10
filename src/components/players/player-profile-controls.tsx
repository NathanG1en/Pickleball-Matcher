"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkUsernameAvailabilityAction,
  leavePublicGroupAction,
  playerLogoutAction,
  updatePlayerProfileAction,
  updatePlayerUsernameAction,
} from "@/app/actions/player-account";
import { Button } from "@/components/ui/button";

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function PlayerProfileHeader({
  initialName,
  initialUsername,
  skillLevel,
  initialRating,
}: {
  initialName: string;
  initialUsername: string;
  skillLevel: string;
  initialRating: number;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [username, setUsername] = useState(initialUsername);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [availability, setAvailability] = useState<{ query: string; available: boolean } | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const cleanUsername = usernameInput.replace(/^@/, "").trim().toLowerCase();
  const isUsernameTaken =
    isEditingUsername &&
    Boolean(cleanUsername) &&
    cleanUsername !== username.toLowerCase() &&
    availability?.query === cleanUsername &&
    !availability.available;

  useEffect(() => {
    if (!isEditingUsername) return;
    const clean = usernameInput.replace(/^@/, "").trim().toLowerCase();
    if (!clean || clean === username.toLowerCase()) return;
    let cancelled = false;
    checkUsernameAvailabilityAction(clean)
      .then((result) => {
        if (!cancelled) {
          setAvailability({ query: clean, available: result.available });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability({ query: clean, available: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [usernameInput, isEditingUsername, username]);

  const handleStartEditName = () => {
    setNameInput(name);
    setNameError(null);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setNameInput(name);
    setNameError(null);
    setIsEditingName(false);
  };

  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed || nameSaving) return;
    if (trimmed === name.trim()) {
      setIsEditingName(false);
      return;
    }
    setNameSaving(true);
    setNameError(null);
    const result = await updatePlayerProfileAction({ name: trimmed });
    if (result.ok) {
      setName(trimmed);
      setIsEditingName(false);
      router.refresh();
    } else {
      setNameError(result.error);
    }
    setNameSaving(false);
  };

  const handleStartEditUsername = () => {
    setUsernameInput(username);
    setAvailability(null);
    setUsernameError(null);
    setIsEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setUsernameInput(username);
    setAvailability(null);
    setUsernameError(null);
    setIsEditingUsername(false);
  };

  const handleSaveUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = usernameInput.replace(/^@/, "").trim().toLowerCase();
    if (!clean || usernameSaving || isUsernameTaken) return;
    if (clean === username.toLowerCase()) {
      setIsEditingUsername(false);
      return;
    }
    setUsernameSaving(true);
    setUsernameError(null);
    const result = await updatePlayerUsernameAction({ username: clean });
    if (result.ok) {
      setUsername(clean);
      setAvailability(null);
      setIsEditingUsername(false);
      router.refresh();
    } else {
      setUsernameError(result.error);
      if (result.error.toLowerCase().includes("taken")) {
        setAvailability({ query: clean, available: false });
      }
    }
    setUsernameSaving(false);
  };

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p className="text-xs font-black uppercase tracking-wider text-neutral-600">Player profile</p>

      {/* Display name row */}
      {isEditingName ? (
        <form onSubmit={handleSaveName} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="profile-name-input"
              aria-label="Display name"
              required
              maxLength={80}
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              className="min-w-0 max-w-xs rounded-xl border-2 border-black bg-white px-3 py-1.5 font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none"
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={nameSaving || !nameInput.trim()}
              className="font-bold uppercase"
            >
              {nameSaving ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              onClick={handleCancelEditName}
              className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
          {nameError && (
            <p role="alert" className="text-xs font-bold text-red-600">{nameError}</p>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-black uppercase truncate">{name}</h1>
          <button
            type="button"
            onClick={handleStartEditName}
            aria-label="Edit display name"
            title="Edit display name"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white p-1.5 text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5"
          >
            <PencilIcon className="h-2 w-2" />
          </button>
        </div>
      )}

      {/* Username row */}
      {isEditingUsername ? (
        <form onSubmit={handleSaveUsername} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-500">@</span>
              <input
                id="profile-username-input"
                aria-label="Username"
                required
                minLength={3}
                maxLength={24}
                value={usernameInput}
                onChange={(event) => {
                  const val = event.target.value.replace(/^@/, "");
                  setUsernameInput(val);
                }}
                aria-invalid={isUsernameTaken}
                className={`w-full rounded-xl pl-7 pr-3 py-1.5 font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none ${
                  isUsernameTaken
                    ? "border-2 border-red-600 bg-red-50 text-red-900"
                    : "border-2 border-black bg-white"
                }`}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={
                usernameSaving ||
                isUsernameTaken ||
                !usernameInput.replace(/^@/, "").trim() ||
                usernameInput.replace(/^@/, "").trim().length < 3 ||
                usernameInput.replace(/^@/, "").trim().length > 24 ||
                !/^[A-Za-z0-9_]+$/.test(usernameInput.replace(/^@/, "").trim())
              }
              className="font-bold uppercase"
            >
              {usernameSaving ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              onClick={handleCancelEditUsername}
              className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
          {isUsernameTaken && (
            <p role="alert" className="text-xs font-bold text-red-600">username taken</p>
          )}
          {usernameError && !isUsernameTaken && (
            <p role="alert" className="text-xs font-bold text-red-600">{usernameError}</p>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-neutral-600">@{username}</p>
          <button
            type="button"
            onClick={handleStartEditUsername}
            aria-label="Edit username"
            title="Edit username"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white p-1 text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5"
          >
            <PencilIcon className="h-2 w-2" />
          </button>
        </div>
      )}

      <p className="pt-1 text-xs font-bold uppercase text-neutral-600">
        {skillLevel} · starting rating {initialRating}
      </p>
    </div>
  );
}

export function PlayerNameEditor({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    if (trimmed === initialName.trim()) {
      setMessage("Name updated.");
      return;
    }
    setPending(true);
    setMessage(null);
    const result = await updatePlayerProfileAction({ name: trimmed });
    setMessage(result.ok ? "Name updated." : result.error);
    if (result.ok) router.refresh();
    setPending(false);
  };
  return <form onSubmit={save} className="space-y-2">
    <label htmlFor="profile-name" className="block text-xs font-black uppercase tracking-wider">Display name</label>
    <div className="flex gap-2"><input id="profile-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 rounded-xl border-2 border-black px-3 py-2 font-bold" /><Button type="submit" variant="primary" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</Button></div>
    {message && <p role="status" className="text-xs font-bold text-neutral-600">{message}</p>}
  </form>;
}

export function PlayerLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const logout = async () => {
    setPending(true);
    await playerLogoutAction();
    router.replace("/");
    router.refresh();
  };
  return <button type="button" onClick={logout} disabled={pending} className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047]">{pending ? "Signing out…" : "Log Out"}</button>;
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async () => {
    setPending(true);
    setError(null);
    const result = await leavePublicGroupAction({ groupId });
    if (result.ok) router.refresh();
    else setError(result.error);
    setPending(false);
  };
  return <div className="flex flex-col items-end gap-1">
    <button type="button" onClick={leave} disabled={pending} className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#ff6b6b] disabled:opacity-60">{pending ? "Leaving…" : "Leave group"}</button>
    {error && <p role="alert" className="max-w-40 text-right text-[10px] font-bold text-red-700">{error}</p>}
  </div>;
}
