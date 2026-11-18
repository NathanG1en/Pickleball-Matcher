import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OtpInput, isCompleteOtp } from "@/components/ui/otp-input";

const digitInputs = (html: string) => html.match(/<input[^>]*>/g) ?? [];

describe("OtpInput", () => {
  it("renders one labelled box per digit inside a named group", () => {
    const html = renderToStaticMarkup(<OtpInput value="" onChange={() => {}} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="6-digit verification code"');
    expect(html).toContain('data-testid="otp-input"');
    const inputs = digitInputs(html);
    expect(inputs).toHaveLength(6);
    expect(inputs[0]).toContain('aria-label="Digit 1 of 6"');
    expect(inputs[5]).toContain('aria-label="Digit 6 of 6"');
    // Every box is a one-time code, so browsers offer the code (which fills every box) and never
    // saved addresses; only the first box has an id, so "email" in it can't fool autofill either.
    expect(inputs.every((input) => /autocomplete="one-time-code"/i.test(input))).toBe(true);
    expect(inputs.filter((input) => / id="/.test(input))).toHaveLength(1);
    expect(html).not.toMatch(/autocomplete="off"/i);
    // The boxes share the width, so six fit a 320px phone.
    expect(html).toContain("grid-template-columns:repeat(6, minmax(0, 1fr))");
  });

  it("shows each digit in its own box and keeps a cleared middle box empty", () => {
    const inputs = digitInputs(renderToStaticMarkup(<OtpInput value="48 7" onChange={() => {}} />));
    expect(inputs.map((input) => input.match(/value="([^"]*)"/)?.[1])).toEqual(["4", "8", "", "7", "", ""]);
    expect(inputs[2]).toContain('data-filled="false"');
    expect(inputs[3]).toContain('data-filled="true"');
  });

  it("auto-focuses the first empty box", () => {
    const inputs = digitInputs(renderToStaticMarkup(<OtpInput value="48" onChange={() => {}} autoFocus />));
    expect(inputs.findIndex((input) => /autofocus/i.test(input))).toBe(2);
  });

  it("marks the group while checking so the boxes can wave", () => {
    expect(renderToStaticMarkup(<OtpInput value="123456" onChange={() => {}} status="checking" />)).toContain('data-state="checking"');
  });

  it("renders custom length when provided", () => {
    const html = renderToStaticMarkup(<OtpInput value="1234" length={4} onChange={() => {}} />);
    expect(digitInputs(html)).toHaveLength(4);
    expect(html).toContain("grid-template-columns:repeat(4, minmax(0, 1fr))");
  });
});

describe("isCompleteOtp", () => {
  it("needs every box filled with a digit", () => {
    expect(isCompleteOtp("123456")).toBe(true);
    expect(isCompleteOtp("12 456")).toBe(false);
    expect(isCompleteOtp("12345")).toBe(false);
    expect(isCompleteOtp("1234", 4)).toBe(true);
  });
});
