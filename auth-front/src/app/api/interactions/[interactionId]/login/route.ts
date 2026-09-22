import { NextResponse } from "next/server";

import type { LoginCredentials, LoginResult } from "@shared/interaction.types";

type RouteContext = { params: Promise<{ interactionId: string }> };

// What the identity provider answers for the right credentials.
type IdentityUser = { id: string; email: string };

// POST /api/interactions/:interactionId/login — the login app's job: check the
// person with the identity provider, then tell the auth server who signed in.
//
// The browser gets one of three answers and nothing finer, always by status:
// 401 wrong credentials (try again), 404 dead sign-in link (start over from the
// application), 502 anything else (the provider is having trouble).
export const POST = async (request: Request, { params }: RouteContext): Promise<NextResponse> => {
  const { AUTH_SERVER_URL = "http://localhost:3000", AUTH_SERVER_ADMIN_KEY = "" } = process.env;
  const { interactionId } = await params;

  // Only the two fields go on, whatever else the browser put in the body.
  const { email, password } = (await request.json()) as LoginCredentials;

  try {
    // 1. Is the password right? Only the identity side answers that, through
    //    `/users`. Its 401 is the single "no" — unknown email and wrong
    //    password alike. A wrong key is a 403, so a misconfiguration never
    //    passes for a wrong password.
    const verifyResponse = await fetch(new URL("/users/verify", AUTH_SERVER_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": AUTH_SERVER_ADMIN_KEY },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (verifyResponse.status === 401) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    if (!verifyResponse.ok) {
      return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
    }

    const user = (await verifyResponse.json()) as IdentityUser;

    // 2. Tell the oauth side who signed in. The subject is the id `/users`
    //    just returned, never anything from the browser — the auth
    //    server believes it on the strength of this app's key, so whoever
    //    holds that key can sign anyone in.
    const acceptUrl = new URL(`/oauth/interactions/${encodeURIComponent(interactionId)}/accept`, AUTH_SERVER_URL);
    const acceptResponse = await fetch(acceptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": AUTH_SERVER_ADMIN_KEY },
      body: JSON.stringify({ subject: user.id, email: user.email }),
      cache: "no-store",
    });

    if (acceptResponse.status === 404) {
      return NextResponse.json({ error: "interaction_expired" }, { status: 404 });
    }
    if (!acceptResponse.ok) {
      return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
    }

    // 3. Tell the browser where to go: the client's redirect_uri, with the code.
    const { redirectTo } = (await acceptResponse.json()) as LoginResult;

    return NextResponse.json({ redirectTo });
  } catch {
    // A server that cannot be reached, or an answer that cannot be read.
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
};
