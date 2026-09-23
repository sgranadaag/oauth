import { NextResponse, type NextRequest } from "next/server";

import type { Session } from "@shared/auth.types";

// POST /api/auth/logout — ends the session on both sides: this app's cookie,
// and the refresh token at the provider.
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const {
    AUTH_SERVER_URL = "http://localhost:3000",
    OAUTH_CLIENT_ID = "",
    OAUTH_CLIENT_SECRET = "",
    OAUTH_REDIRECT_URI = "http://localhost:3001/api/auth/callback",
  } = process.env;

  // This app's own address, from the redirect URI: in a container
  // `request.nextUrl.origin` would be the bound address, `0.0.0.0`.
  const { origin } = new URL(OAUTH_REDIRECT_URI);

  // 1. The refresh token, if this browser still has a session.
  let session: Session | null = null;
  try {
    session = JSON.parse(request.cookies.get("session")?.value ?? "null");
  } catch {
    session = null;
  }

  // 2. Revoke it (RFC 7009), which ends that session at the provider — the
  //    presented token and every one it was rotated from. Best effort: if the
  //    provider cannot be reached, the person still signs out of this app.
  //    The access token already issued keeps working until it expires; a JWT
  //    verified offline cannot be withdrawn.
  if (session?.refreshToken) {
    try {
      await fetch(new URL("/oauth/revoke", AUTH_SERVER_URL), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: session.refreshToken,
          token_type_hint: "refresh_token",
        }),
        cache: "no-store",
      });
    } catch {
      // Nothing to do about it here, and nothing to tell the person.
    }
  }

  // 3. 303 turns the form's POST into a GET of the home page.
  const response = NextResponse.redirect(new URL("/", origin), 303);
  response.cookies.delete("session");

  return response;
};
