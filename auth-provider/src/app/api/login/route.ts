import { NextResponse } from "next/server";

import { toSession } from "@adapters/login.adapter";
import { hasClientCredentials, requestToken } from "@server/authServer.service";
import type { LoginCredentials } from "@shared/auth.types";

// This handler is the whole reason the provider has a server side: it is where
// the client secret lives. The browser posts here, never to the auth server.
export const POST = async (request: Request): Promise<NextResponse> => {
  if (!hasClientCredentials()) {
    return NextResponse.json(
      { error: "OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET are not configured" },
      { status: 500 }
    );
  }

  const credentials = (await request.json()) as LoginCredentials;

  try {
    return NextResponse.json(toSession(await requestToken(credentials)));
  } catch {
    // The auth server's own body is never forwarded: it answers the same
    // invalid_grant for an unknown email and a wrong password, and a login
    // form must not become a way to tell them apart.
    return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
  }
};
