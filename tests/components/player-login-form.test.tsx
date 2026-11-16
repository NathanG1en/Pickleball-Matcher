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

describe("PlayerLoginForm", () => {
  it("renders username or email input with proper label and placeholder", () => {
    const html = renderToStaticMarkup(<PlayerLoginForm />);

    expect(html).toContain("Username or Email");
    expect(html).toContain('id="player-login-username"');
    expect(html).toContain('placeholder="e.g. rally_champ or you@example.com"');
    expect(html).toContain('id="player-login-password"');
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

