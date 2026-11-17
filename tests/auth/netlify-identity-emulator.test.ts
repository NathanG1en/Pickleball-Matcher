import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  GET,
  POST,
  PUT,
} from "@/app/api/netlify-identity/[...slug]/route";

describe("Netlify Identity Local Development Emulator", () => {
  it("handles password recovery request and generates token", async () => {
    const req = new NextRequest("http://localhost:3000/.netlify/identity/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "player@example.com" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ slug: ["recover"] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({});
  });

  it("handles verification request and returns access session with user payload", async () => {
    const req = new NextRequest("http://localhost:3000/.netlify/identity/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "dev_rec_sample123", type: "recovery" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ slug: ["verify"] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access_token).toBeDefined();
    expect(typeof data.access_token).toBe("string");
    expect(data.user).toBeDefined();
    expect(data.user.email).toBeDefined();
  });

  it("handles user password update with authorization bearer header", async () => {
    const req = new NextRequest("http://localhost:3000/.netlify/identity/user", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock_token_string",
      },
      body: JSON.stringify({ password: "new-secure-password" }),
    });

    const res = await PUT(req, {
      params: Promise.resolve({ slug: ["user"] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.updated_at).toBeDefined();
  });

  it("handles Google OAuth redirect with mock JWT access token in URL hash", async () => {
    const req = new NextRequest(
      "http://localhost:3000/.netlify/identity/authorize?provider=google",
      { method: "GET" },
    );

    const res = await GET(req, {
      params: Promise.resolve({ slug: ["authorize"] }),
    });
    expect(res.status).toBe(307); // NextResponse.redirect
    const location = res.headers.get("location");
    expect(location).toBeDefined();
    expect(location).toContain("#access_token=");
    const token = new URLSearchParams(location!.split("#")[1]).get("access_token")!;
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
    expect(payload.email).toBe("google.dev@example.com");
    expect(payload.app_metadata.provider).toBe("google");
  });
});

