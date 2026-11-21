import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerLoginForm } from "@/components/players/player-login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/player-account", () => ({
  playerLoginAction: vi.fn(),
}));

import PlayerLoginPage from "@/app/player-login/page";

describe("PlayerLoginForm", () => {
  it("renders username or email input with proper label and placeholder", () => {
    const html = renderToStaticMarkup(<PlayerLoginForm />);

    expect(html).toContain("Username or Email");
    expect(html).toContain('id="player-login-username"');
    expect(html).toContain('placeholder="e.g. rally_champ or you@example.com"');
    expect(html).toContain("Forgot password?");
    expect(html).toContain("Continue with Google");
    expect(html).toContain("Sign In");
  });

  it("displays initial error message when passed", () => {
    const html = renderToStaticMarkup(
      <PlayerLoginForm initialError="Unable to sign in. Check your username or email and password." />
    );

    expect(html).toContain("Unable to sign in. Check your username or email and password.");
  });
});

describe("PlayerLoginPage layout", () => {
  it("renders with data-fill-screen and vertical centering without min-h-screen overflow", async () => {
    const jsx = await PlayerLoginPage({});
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("data-fill-screen");
    expect(html).toContain("flex flex-1 items-center justify-center");
    expect(html).toContain("my-auto");
    expect(html).not.toContain("min-h-screen");
    expect(html).toContain("Player Sign In");
  });
});

