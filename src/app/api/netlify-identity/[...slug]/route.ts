import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// In-memory token store for local development sessions
interface DevRecoveryRecord {
  email: string;
  expires: number;
}
const devRecoveryTokens = new Map<string, DevRecoveryRecord>();

function createMockJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64Header}.${b64Payload}.local_dev_mock_signature`;
}

function decodeMockJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    }
  } catch {
    // fallback
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const action = slug.join("/");

  // 1. POST /.netlify/identity/recover
  if (action === "recover") {
    let email = "player@example.com";
    try {
      const body = await request.json();
      if (body?.email) email = String(body.email).trim().toLowerCase();
    } catch {
      // fallback
    }

    const token = `dev_rec_${randomBytes(16).toString("hex")}`;
    devRecoveryTokens.set(token, {
      email,
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    const origin = request.nextUrl.origin;
    const recoveryLink = `${origin}/#recovery_token=${token}`;

    const separator = "═".repeat(78);
    console.info(`\n${separator}`);
    console.info("📬 [NETLIFY IDENTITY LOCAL EMULATOR - PASSWORD RECOVERY]");
    console.info(`   Target Email : ${email}`);
    console.info(`   Direct Link  : ${recoveryLink}`);
    console.info("   ℹ️  Open this link in your browser to test Netlify Identity recovery.");
    console.info(`${separator}\n`);

    return NextResponse.json({}, { status: 200 });
  }

  // 2. POST /.netlify/identity/verify
  if (action === "verify") {
    let token = "";
    try {
      const body = await request.json();
      if (body?.token) token = String(body.token);
    } catch {
      // fallback
    }

    const record = devRecoveryTokens.get(token);
    const email = record?.email || "developer@example.com";
    const sub = `usr_dev_${randomBytes(6).toString("hex")}`;

    const accessToken = createMockJwt({
      sub,
      email,
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Local Player" },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: `dev_refresh_${randomBytes(12).toString("hex")}`,
        user: {
          id: sub,
          email,
          app_metadata: { provider: "email" },
          user_metadata: { full_name: "Local Player" },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      { status: 200 },
    );
  }

  // 3. POST /.netlify/identity/signup
  if (action === "signup") {
    let email = "newplayer@example.com";
    let data: Record<string, unknown> = {};
    try {
      const body = await request.json();
      if (body?.email) email = String(body.email).trim().toLowerCase();
      if (body?.data) data = body.data;
    } catch {
      // fallback
    }

    const sub = `usr_dev_${randomBytes(6).toString("hex")}`;
    return NextResponse.json(
      {
        id: sub,
        email,
        user_metadata: data,
        created_at: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  // 4. POST /.netlify/identity/token (password login)
  if (action === "token") {
    let email = "player@example.com";
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await request.text();
        const search = new URLSearchParams(text);
        if (search.get("username")) email = search.get("username")!;
      } else {
        const body = await request.json();
        if (body?.username) email = String(body.username);
      }
    } catch {
      // fallback
    }

    const sub = `usr_dev_${randomBytes(6).toString("hex")}`;
    const accessToken = createMockJwt({
      sub,
      email,
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Local Player" },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: sub,
          email,
        },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ msg: `Unsupported action: ${action}` }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const action = slug.join("/");

  // 1. GET /.netlify/identity/authorize?provider=google
  if (action === "authorize") {
    const origin = request.nextUrl.origin;
    const provider = request.nextUrl.searchParams.get("provider") || "google";

    const mockGoogleJwt = createMockJwt({
      sub: "google_dev_player_1",
      email: "google.dev@example.com",
      user_metadata: {
        full_name: "Google Dev Player",
        avatar_url: "",
      },
      app_metadata: {
        provider,
      },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // In Netlify Identity OAuth, the redirect returns to the site's origin with the token in the hash
    const targetUrl = new URL("/", origin);
    targetUrl.hash = `access_token=${mockGoogleJwt}&token_type=bearer&expires_in=3600`;
    return NextResponse.redirect(targetUrl.toString());
  }

  // 2. GET /.netlify/identity/user
  if (action === "user") {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const decoded = decodeMockJwt(token);

    return NextResponse.json(
      {
        id: (decoded?.sub as string) || "usr_dev_player",
        email: (decoded?.email as string) || "dev@example.com",
        user_metadata: decoded?.user_metadata || { full_name: "Local Player" },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ msg: `Unsupported action: ${action}` }, { status: 404 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const action = slug.join("/");

  // PUT /.netlify/identity/user (update password / profile)
  if (action === "user") {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const decoded = decodeMockJwt(token);

    return NextResponse.json(
      {
        id: (decoded?.sub as string) || "usr_dev_player",
        email: (decoded?.email as string) || "dev@example.com",
        updated_at: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ msg: `Unsupported action: ${action}` }, { status: 404 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
