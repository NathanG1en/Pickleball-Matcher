"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createAccountGroupAction } from "@/app/actions/auth";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { saveRecentGroup } from "@/lib/storage/recent-groups";

const emptySubscribe = () => () => {};

export function CreateGroupForm() {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const result = await createAccountGroupAction({ name, isPublic });
    if (!result.ok) {
      setError(result.error);
      setIsPending(false);
      return;
    }
    saveRecentGroup({ id: result.data.groupId, name: result.data.name });
    router.push(`/g/${result.data.groupId}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-hydrated={mounted ? "true" : undefined}>
      {error && (
        <Alert variant="danger-soft" size="md">
          {error}
        </Alert>
      )}

      <FormField
        id="group-name"
        label="Group name"
        hint="Names are case-sensitive and must be unique."
      >
        <Input
          id="group-name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Tuesday Morning Doubles"
        />
      </FormField>

      <label className="flex items-start gap-3 rounded-xl border-2 border-black bg-neutral-50 p-4 text-sm font-bold">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-black"
        />
        <span>Make this group public so players can find and join it.</span>
      </label>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending || !name.trim()}
        className="w-full font-display text-lg uppercase"
      >
        {isPending ? "Creating…" : "Create Group"}
      </Button>
    </form>
  );
}
