import React from "react";
import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PartnerRequests } from "@/components/sessions/partner-requests";
vi.mock("@/app/actions/partner-requests", () => ({ listPartnerRequestsAction: vi.fn(), submitPartnerRequestAction: vi.fn(), cancelPartnerRequestAction: vi.fn(), decidePartnerRequestAction: vi.fn() }));
const session = { id: "s", groupId: "g", status: "active" as const, courtCount: 1, currentRoundNumber: 0, version: 1, startedAt: new Date(), endedAt: null };
const props = { groupId: "g", session, players: [{ id: "a", name: "Alex" }, { id: "b", name: "Sam" }], presentPlayerIds: ["a", "b"], currentViewerPlayerId: "a", initialRequests: [], onSessionUpdated: async () => {} };
const pending = { id: "r", sessionId: "s", requesterPlayerId: "a", partnerPlayerId: "b", status: "pending" as const, createdAt: new Date(), resolvedAt: null, version: 1 };
it("gives members a named partner selector and request action without organizer decisions", () => {
  const html = renderToStaticMarkup(<PartnerRequests {...props} canManage={false} />);
  expect(html).toContain('aria-label="Requested partner"');
  expect(html).toContain("Request Stay Together");
  expect(html).not.toContain("Approve Alex and Sam");
});
it("gives organizers a pending count and accessible approve/decline controls", () => {
  const html = renderToStaticMarkup(<PartnerRequests {...props} canManage initialRequests={[pending]} />);
  expect(html).toContain("1 pending");
  expect(html).toContain('aria-label="Approve Alex and Sam"');
  expect(html).toContain('aria-label="Decline Alex and Sam"');
});
it("allows only the requester to see a cancel action and hides new submissions in ended sessions", () => {
  const own = renderToStaticMarkup(<PartnerRequests {...props} canManage={false} initialRequests={[pending]} />);
  expect(own).toContain('aria-label="Cancel request to Sam"');
  const incoming = renderToStaticMarkup(<PartnerRequests {...props} currentViewerPlayerId="b" canManage={false} initialRequests={[pending]} />);
  expect(incoming).not.toContain("Cancel request to");
  const ended = renderToStaticMarkup(<PartnerRequests {...props} session={{ ...session, status: "completed" }} canManage={false} />);
  expect(ended).not.toContain("<select");
});
