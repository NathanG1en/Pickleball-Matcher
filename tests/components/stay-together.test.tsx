import React from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StayTogetherEditor } from "@/components/attendance/stay-together-editor";
const players = [{ id: "a", name: "Alex" }, { id: "b", name: "Sam" }, { id: "c", name: "Casey" }];
it("names pairs, the single bench exception, and accessible removal controls", () => {
  const html = renderToStaticMarkup(<StayTogetherEditor players={players} pairs={[["a", "b"]]} onChange={() => {}} />);
  expect(html).toContain("Alex &amp; Sam");
  expect(html).toContain('aria-label="Remove pairing Alex and Sam"');
  expect(html).toContain('aria-label="First friend"');
  expect(html).toContain("one bench spot");
});
it("hides editing controls from members", () => {
  const html = renderToStaticMarkup(<StayTogetherEditor players={players} pairs={[["a", "b"]]} />);
  expect(html).toContain("Alex &amp; Sam");
  expect(html).not.toContain("<select");
  expect(html).not.toContain("Remove pairing");
});
