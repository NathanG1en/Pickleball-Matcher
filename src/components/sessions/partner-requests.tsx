"use client";

import React, { useEffect, useRef, useState } from "react";
import { listPartnerRequestsAction, submitPartnerRequestAction, cancelPartnerRequestAction, decidePartnerRequestAction } from "@/app/actions/partner-requests";
import type { ActionResult } from "@/app/actions/auth";
import type { PartnerRequestRecord, PartnerRequestView, SessionRecord } from "@/lib/domain/types";

export function PartnerRequests({ groupId, session, players, presentPlayerIds, currentViewerPlayerId, canManage, initialRequests, disabled = false, onBusyChange, onSessionUpdated }: {
  groupId: string;
  session: SessionRecord;
  players: readonly { id: string; name: string }[];
  presentPlayerIds: readonly string[];
  currentViewerPlayerId: string | null;
  canManage: boolean;
  initialRequests: readonly PartnerRequestRecord[];
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onSessionUpdated: (session: SessionRecord) => Promise<void>;
}) {
  const [view, setView] = useState({ source: initialRequests, requests: initialRequests, players, presentPlayerIds });
  if (initialRequests !== view.source) setView({ source: initialRequests, requests: initialRequests, players, presentPlayerIds });
  const { requests, players: currentPlayers, presentPlayerIds: currentPresentIds } = view;
  const [partnerId, setPartnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const names = new Map(currentPlayers.map(player => [player.id, player.name]));
  const active = session.status === "active";
  const paired = new Set((session.stayTogetherPairs ?? []).flat());
  const ownPending = requests.find(request => request.status === "pending" && request.requesterPlayerId === currentViewerPlayerId);
  const available = currentPlayers.filter(player => player.id !== currentViewerPlayerId && currentPresentIds.includes(player.id) && !paired.has(player.id))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  const pending = requests.filter(request => request.status === "pending");
  const displayed = [...pending, ...requests.filter(request => request.status !== "pending").slice(0, 5)];
  const canRequest = active && !canManage && currentViewerPlayerId && currentPresentIds.includes(currentViewerPlayerId) && !paired.has(currentViewerPlayerId) && !ownPending;
  const context = { groupId, sessionId: session.id };

  async function run(operation: () => Promise<ActionResult<PartnerRequestView>>, changesPairs = false) {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    let blocked = changesPairs;
    if (blocked) onBusyChange?.(true);
    try {
      const response = await operation();
      if (!response.ok) { setError(response.error); return; }
      setView({ source: initialRequests, requests: response.data.requests, players: response.data.players, presentPlayerIds: response.data.presentPlayerIds });
      if (response.data.session.version !== session.version) {
        if (!blocked) { blocked = true; onBusyChange?.(true); }
        await onSessionUpdated(response.data.session);
      }
    } catch { setError("Unable to update requests. Refresh and try again."); }
    finally {
      inFlight.current = false;
      setBusy(false);
      if (blocked) onBusyChange?.(false);
    }
  }

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void run(() => listPartnerRequestsAction({ groupId, sessionId: session.id }));
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
    // run captures the current session version and the parent's current preview callback.
  });

  const buttonClass = "rounded-lg border-2 border-black px-3 py-2 text-xs font-black disabled:opacity-50";
  const locked = disabled || busy;
  return <section data-testid="partner-requests" className="rounded-2xl border-[3px] border-black bg-white p-5 space-y-3 shadow-[4px_4px_0px_0px_#000]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-2xl font-black uppercase">Partner requests {canManage && <span className="font-sans text-xs normal-case">{pending.length} pending</span>}</h2>
      <button type="button" disabled={locked} className={buttonClass} onClick={() => void run(() => listPartnerRequestsAction(context))}>Refresh requests</button>
    </div>
    <p className="text-sm text-neutral-600">{canManage ? "Approve a pair for future rounds. Approving also declines competing requests involving either player." : "Ask an organizer to keep you with a friend for this session. Your friend does not need to confirm."}</p>
    {!active && <p className="text-sm font-bold">This session has ended. Pending requests can no longer be approved.</p>}
    {canRequest && <form onSubmit={event => { event.preventDefault(); if (available.some(player => player.id === partnerId)) void run(() => submitPartnerRequestAction({ ...context, partnerPlayerId: partnerId })); }} className="space-y-2">
      <select aria-label="Requested partner" value={partnerId} disabled={locked} onChange={event => setPartnerId(event.target.value)} className="w-full rounded-xl border-2 border-black bg-white p-2 text-sm font-bold disabled:opacity-50">
        <option value="">Choose your friend</option>{available.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select>
      <button type="submit" disabled={locked || !available.some(player => player.id === partnerId)} className={`${buttonClass} bg-[#ccff00]`}>Request Stay Together</button>
      {!available.length && <p className="text-sm">No unpaired friends are currently attending.</p>}
    </form>}
    {!canManage && active && currentViewerPlayerId && paired.has(currentViewerPlayerId) && <p className="text-sm font-bold">You already have a Stay Together partner. Ask an organizer if you want to change partners.</p>}
    {!canManage && active && !currentPresentIds.includes(currentViewerPlayerId ?? "") && <p className="text-sm">Join this session before requesting a partner.</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {busy && <p role="status" className="text-sm font-bold">Updating requests…</p>}
    {!displayed.length ? <p className="text-sm text-neutral-500">No partner requests yet.</p> : <ul className="space-y-2">{displayed.map(request => {
      const requester = names.get(request.requesterPlayerId) ?? "Former player";
      const partner = names.get(request.partnerPlayerId) ?? "Former player";
      return <li key={request.id} className="rounded-xl border-2 border-black bg-neutral-50 p-3 space-y-2">
        <p className="text-sm font-bold">{requester} → {partner}</p>
        <p className="text-xs font-black">{{ pending: "Pending", approved: "Approved", declined: "Declined", cancelled: "Cancelled" }[request.status]}</p>
        {active && request.status === "pending" && <div className="flex flex-wrap gap-2">
          {canManage && <>
            <button type="button" disabled={locked} aria-label={`Approve ${requester} and ${partner}`} className={`${buttonClass} bg-[#ccff00]`} onClick={() => void run(() => decidePartnerRequestAction({ ...context, requestId: request.id, decision: "approved" }), true)}>Approve</button>
            <button type="button" disabled={locked} aria-label={`Decline ${requester} and ${partner}`} className={buttonClass} onClick={() => void run(() => decidePartnerRequestAction({ ...context, requestId: request.id, decision: "declined" }))}>Decline</button>
          </>}
          {request.requesterPlayerId === currentViewerPlayerId && <button type="button" disabled={locked} aria-label={`Cancel request to ${partner}`} className={buttonClass} onClick={() => void run(() => cancelPartnerRequestAction({ ...context, requestId: request.id }))}>Cancel request</button>}
        </div>}
      </li>;
    })}</ul>}
  </section>;
}
