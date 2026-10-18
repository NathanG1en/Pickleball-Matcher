const markerKey = (groupId: string) => `pickleball:session-ended:${groupId}`;

// A one-use handoff to the group dashboard, after the server confirms completion.
export function markSessionEnded(groupId: string, sessionId: string): void {
  try {
    window.sessionStorage.setItem(markerKey(groupId), JSON.stringify({ sessionId, at: Date.now() }));
  } catch { /* Ending a session must not depend on browser storage. */ }
}

export function consumeSessionEnded(groupId: string, sessionId: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(markerKey(groupId));
    window.sessionStorage.removeItem(markerKey(groupId));
    if (!raw) return false;
    const marker = JSON.parse(raw);
    return marker?.sessionId === sessionId && typeof marker?.at === "number"
      && Date.now() - marker.at >= 0 && Date.now() - marker.at <= 30_000;
  } catch { return false; }
}
