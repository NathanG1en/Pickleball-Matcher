"use client";

import React, { useState } from "react";
import type { StayTogetherPair } from "@/lib/matchmaking/types";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

export function StayTogetherEditor({ players, pairs, onChange, disabled = false, eligibleIds, pending = false }: {
  players: readonly { id: string; name: string }[];
  pairs: readonly StayTogetherPair[];
  onChange?: (pairs: readonly StayTogetherPair[]) => void;
  disabled?: boolean;
  eligibleIds?: readonly string[];
  pending?: boolean;
}) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const used = new Set(pairs.flat());
  const names = new Map(players.map(p => [p.id, p.name]));
  const available = players.filter(p => !used.has(p.id) && (!eligibleIds || eligibleIds.includes(p.id)));
  const options = available.slice().sort((a, b) => a.name.localeCompare(b.name));
  return <section className="rounded-2xl border-[3px] border-black bg-[#FFFDF7] p-5 space-y-3 shadow-[4px_4px_0px_0px_#000]" data-testid="stay-together-settings">
    <h2 className="font-display text-2xl font-black uppercase">Stay Together <span className="text-sm font-sans font-bold normal-case">(optional)</span></h2>
    <p className="text-sm text-neutral-600">Friends play and sit together. With one bench spot, everyone takes turns sitting and the other friend gets a temporary teammate.</p>
    {pairs.length ? <ul className="space-y-2">{pairs.map(([a, b]) => <li key={JSON.stringify([a, b])} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-[#ccff00]/20 px-3 py-2">
      <span className="font-bold text-sm">{names.get(a) ?? "Unavailable player"} &amp; {names.get(b) ?? "Unavailable player"}</span>
      {onChange && <button type="button" disabled={disabled} aria-label={`Remove pairing ${names.get(a) ?? a} and ${names.get(b) ?? b}`} onClick={() => onChange(pairs.filter(([first, second]) => first !== a || second !== b))} className="rounded-lg border-2 border-black px-2 py-1 text-xs font-black disabled:opacity-50">Remove</button>}
    </li>)}</ul> : <p className="text-sm font-bold text-neutral-500">No pairs selected. Players rotate normally.</p>}
    {onChange && <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <CustomDropdown
          ariaLabel="First friend"
          className="w-full"
          buttonClassName="w-full justify-between"
          disabled={disabled}
          value={first}
          onChange={(val) => { setFirst(val); setSecond(""); }}
          options={[{ value: "", label: "First friend" }, ...options.map(p => ({ value: p.id, label: p.name }))]}
          sizeVariant="sm"
        />
        <CustomDropdown
          ariaLabel="Second friend"
          className="w-full"
          buttonClassName="w-full justify-between"
          disabled={disabled || !first}
          value={second}
          onChange={(val) => setSecond(val)}
          options={[{ value: "", label: "Second friend" }, ...options.filter(p => p.id !== first).map(p => ({ value: p.id, label: p.name }))]}
          sizeVariant="sm"
        />
      </div>
      <button type="button" disabled={disabled || !available.some(p => p.id === first) || !available.some(p => p.id === second) || first === second} className="rounded-xl border-2 border-black bg-black text-white px-4 py-2 text-sm font-bold disabled:opacity-50" onClick={() => { onChange([...pairs, [first, second]]); setFirst(""); setSecond(""); }}>Add pair</button>
    </div>}
    {pending && <p role="status" className="text-sm font-bold">Saving pairs…</p>}
  </section>;
}
