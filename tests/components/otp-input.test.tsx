import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OtpInput } from "@/components/ui/otp-input";

describe("OtpInput", () => {
  it("renders 6 segmented slots by default", () => {
    const html = renderToStaticMarkup(
      <OtpInput value="" onChange={() => {}} />
    );

    expect(html).toContain('data-testid="otp-input"');
    // Six fluid slots sharing the width, so they never overflow a narrow card
    expect(html.match(/aspect-\[4\/5\]/g)).toHaveLength(6);
    expect(html).toContain("grid-template-columns:repeat(6, minmax(0, 1fr))");
    expect(html).not.toMatch(/\bw-11\b/);
  });

  it("renders partially filled digits in the corresponding slots", () => {
    const html = renderToStaticMarkup(
      <OtpInput value="482" onChange={() => {}} />
    );

    expect(html).toContain("4");
    expect(html).toContain("8");
    expect(html).toContain("2");
  });

  it("highlights the next empty slot through focus-within, without waiting for React focus events", () => {
    const html = renderToStaticMarkup(<OtpInput value="48" onChange={() => {}} />);
    expect(html.match(/group-focus-within:bg-\[#ccff00\]/g)).toHaveLength(1);
    const slots = html.split('aspect-[4/5]').slice(1);
    expect(slots[2]).toContain("group-focus-within:bg-[#ccff00]");
  });

  it("renders custom length when provided", () => {
    const html = renderToStaticMarkup(
      <OtpInput value="1234" length={4} onChange={() => {}} />
    );

    expect(html.match(/aspect-\[4\/5\]/g)).toHaveLength(4);
    expect(html).toContain("grid-template-columns:repeat(4, minmax(0, 1fr))");
  });
});
