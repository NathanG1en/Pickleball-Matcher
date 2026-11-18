import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OtpInput } from "@/components/ui/otp-input";

describe("OtpInput", () => {
  it("renders 6 segmented slots by default", () => {
    const html = renderToStaticMarkup(
      <OtpInput value="" onChange={() => {}} />
    );

    expect(html).toContain('data-testid="otp-input"');
    // Expect 6 slot boxes rendered
    const slotMatches = html.match(/w-11 h-13/g);
    expect(slotMatches).toHaveLength(6);
  });

  it("renders partially filled digits in the corresponding slots", () => {
    const html = renderToStaticMarkup(
      <OtpInput value="482" onChange={() => {}} />
    );

    expect(html).toContain("4");
    expect(html).toContain("8");
    expect(html).toContain("2");
  });

  it("renders custom length when provided", () => {
    const html = renderToStaticMarkup(
      <OtpInput value="1234" length={4} onChange={() => {}} />
    );

    const slotMatches = html.match(/w-11 h-13/g);
    expect(slotMatches).toHaveLength(4);
  });
});
