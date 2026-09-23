import { NextResponse, type NextRequest } from "next/server";

import type { Session, TokenResponse } from "@shared/auth.types";

// Same window as the callback writes: the cookie has to outlive the access
// token for a renewal to be possible at all.
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

// POST /api/auth/refresh — trades the refresh token for a new pair, without
// sending the person back to the provider. The person never sees this: it is
// the back channel, with the client secret, exactly like the code exchange.
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const {
    AUTH_SERVER_URL = "http://localhost:3000",
    OAUTH_CLIENT_ID = "",
    OAUTH_CLIENT_SECRET = "",
    OAUTH_REDIRECT_URI = "http://localhost:3001/api/auth/callback",
  } = process.env;
  const { origin } = new URL(OAUTH_REDIRECT_URI);

  // 303 so the form's POST becomes a GET of the home page, which re-renders
  // with whatever the session cookie now holds.
  const finish = (error?: string): NextResponse => {
    const home = new URL("/", origin);
    if (error) home.searchParams.set("error", error);

    return NextResponse.redirect(home, 303);
  };

  // 1. The session, and the refresh token inside it.
  let session: Session | null = null;
  try {
    session = JSON.parse(request.cookies.get("session")?.value ?? "null");
  } catch {
    session = null;
  }

  if (!session?.refreshToken) {
    return finish("session_expired");
  }

  // 2. The refresh grant, server to server (RFC 6749 §6): the refresh token
  //    and this app's secret, never anything from the browser.
  let tokens: TokenResponse;
  try {
    const tokenResponse = await fetch(new URL("/oauth/token", AUTH_SERVER_URL), {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
      cache: "no-store",
    });

    // A refused refresh means the session is over — expired, already rotated
    // away, or revoked. Drop it rather than leaving a dead one behind.
    if (!tokenResponse.ok) {
      const expired = finish("session_expired");
      expired.cookies.delete("session");

      return expired;
    }

    tokens = (await tokenResponse.json()) as TokenResponse;
  } catch {
    // The provider is unreachable: the session may still be good, so keep it.
    return finish("refresh_failed");
  }

  // 3. The provider rotates on every refresh, so the answer carries a *new*
  //    refresh token. Storing it is what makes the next renewal work; keeping
  //    the old one would look like reuse and end the whole session.
  const renewed: Session = {
    ...session,
    scope: tokens.scope,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  const response = finish();
  response.cookies.set("session", JSON.stringify(renewed), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
};
