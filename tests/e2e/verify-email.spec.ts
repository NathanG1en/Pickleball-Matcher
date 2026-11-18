import { test, expect, type Page } from "@playwright/test";

const digits = (page: Page) =>
  Promise.all(Array.from({ length: 6 }, (_, idx) => page.getByTestId(`verify-email-otp-digit-${idx}`).inputValue()));

test.describe("Verify Email code boxes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/verify-email?email=player%40example.com");
    await expect(page.getByRole("heading", { name: "Verify Email" })).toBeVisible();
    // The first box is focused on load, so typing starts there.
    await expect(page.getByTestId("verify-email-otp-digit-0")).toBeFocused();
  });

  test("lets a player tap or arrow to any box to fix a digit", async ({ page }) => {
    await page.keyboard.type("123");
    expect(await digits(page)).toEqual(["1", "2", "3", "", "", ""]);
    await expect(page.getByTestId("verify-email-otp-digit-3")).toBeFocused();

    // Tap the second box and retype it; the digit is replaced and the cursor moves on.
    await page.getByTestId("verify-email-otp-digit-1").click();
    await page.keyboard.type("9");
    expect(await digits(page)).toEqual(["1", "9", "3", "", "", ""]);
    await expect(page.getByTestId("verify-email-otp-digit-2")).toBeFocused();

    // Arrow keys move between boxes.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("verify-email-otp-digit-0")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("verify-email-otp-digit-1")).toBeFocused();

    // Backspace clears a middle box without sliding the later digits over.
    await page.keyboard.press("Backspace");
    expect(await digits(page)).toEqual(["1", "", "3", "", "", ""]);
    await expect(page.getByRole("button", { name: "Verify Code" })).toBeDisabled();

    // Backspace in an empty box steps back and clears the one before.
    await page.getByTestId("verify-email-otp-digit-3").click();
    await page.keyboard.press("Backspace");
    expect(await digits(page)).toEqual(["1", "", "", "", "", ""]);
    await expect(page.getByTestId("verify-email-otp-digit-2")).toBeFocused();
  });

  test("fills every box from a pasted code and reports a wrong code without losing it", async ({ page }) => {
    await page.getByTestId("verify-email-otp-digit-2").evaluate((input: HTMLInputElement) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setValue.call(input, "654321");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(await digits(page)).toEqual(["6", "5", "4", "3", "2", "1"]);

    // A complete code is checked straight away; a wrong one shows an error and keeps the digits to fix.
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(await digits(page)).toEqual(["6", "5", "4", "3", "2", "1"]);
    await expect(page.getByRole("button", { name: "Verify Code" })).toBeEnabled();

    // Focus returns to the first box, so retyping overwrites the code from the start. Fixing digits
    // of a complete code doesn't resend it after every keystroke; typing the last box does.
    await expect(page.getByTestId("verify-email-otp-digit-0")).toBeFocused();
    await page.keyboard.type("78");
    expect(await digits(page)).toEqual(["7", "8", "4", "3", "2", "1"]);
    await expect(page.locator("main").getByRole("alert")).toBeHidden();
    await expect(page.getByTestId("verify-email-otp-digit-2")).toBeEnabled();
    await page.keyboard.type("9999");
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    expect(await digits(page)).toEqual(["7", "8", "9", "9", "9", "9"]);
  });
});
