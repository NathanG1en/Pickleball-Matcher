"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSessionNameAction } from "@/app/actions/sessions";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "@/components/ui/icons";

export function SessionNameEditor({
  groupId,
  sessionId,
  initialName,
  canEdit = true,
  headingTag: Heading = "h1",
  className = "font-display text-2xl sm:text-3xl font-black uppercase text-black tracking-tight truncate",
  onRenamed,
}: {
  groupId: string;
  sessionId: string;
  initialName: string;
  canEdit?: boolean;
  headingTag?: "h1" | "h2" | "h3";
  className?: string;
  onRenamed?: (newName: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [prevInitialName, setPrevInitialName] = useState(initialName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName);
    setName(initialName);
    setNameInput(initialName);
  }

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
    const result = await updateSessionNameAction({ groupId, sessionId, name: trimmed });
    if (result.ok) {
      setName(trimmed);
      setIsEditingName(false);
      onRenamed?.(trimmed);
      router.refresh();
    } else {
      setNameError(result.error ?? "Failed to update session name.");
    }
    setNameSaving(false);
  };

  if (isEditingName) {
    return (
      <form onSubmit={handleSaveName} className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="session-name-input"
            aria-label="Session name"
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
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Heading className={className} suppressHydrationWarning>
        {name}
      </Heading>
      {canEdit && (
        <button
          type="button"
          onClick={handleStartEditName}
          aria-label="Edit session name"
          title="Edit session name"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white p-1.5 text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5"
        >
          <PencilIcon className="h-2 w-2" />
        </button>
      )}
    </div>
  );
}

