"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupNameAction } from "@/app/actions/group-settings";
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

export function GroupNameEditor({
  groupId,
  initialName,
  canEdit = true,
}: {
  groupId: string;
  initialName: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

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
    const result = await updateGroupNameAction({ groupId, name: trimmed });
    if (result.ok) {
      setName(trimmed);
      setIsEditingName(false);
      router.refresh();
    } else {
      setNameError(result.error ?? "Failed to update group name.");
    }
    setNameSaving(false);
  };

  if (isEditingName) {
    return (
      <form onSubmit={handleSaveName} className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="group-name-input"
            aria-label="Group name"
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
      <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-black tracking-tight truncate">
        {name}
      </h1>
      {canEdit && (
        <button
          type="button"
          onClick={handleStartEditName}
          aria-label="Edit group name"
          title="Edit group name"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white p-1.5 text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5"
        >
          <PencilIcon className="h-2 w-2" />
        </button>
      )}
    </div>
  );
}

