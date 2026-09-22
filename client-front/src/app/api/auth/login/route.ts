import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import type { AuthorizationTransaction } from "@shared/auth.types";

// GET /api/auth/login — step 1: send the browser to the provider.
export const GET = (): NextResponse => {
  const {
    AUTH_SERVER_URL = "http://localhost:3000",
    // Where the browser reaches the auth server; differs from AUTH_SERVER_URL only in Docker.
    AUTH_SERVER_PUBLIC_URL = AUTH_SERVER_URL,
    OAUTH_CLIENT_ID = "",
    OAUTH_REDIRECT_URI = "http://localhost:3001/api/auth/callback",
    OAUTH_SCOPE = "openid read write",
  } = process.env;

  // Three one-time values for this sign-in: `state` against CSRF, `nonce`
  // against a replayed ID token, and the PKCE verifier.
  const transaction: AuthorizationTransaction = {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    codeVerifier: randomBytes(32).toString("base64url"),
  };

  // PKCE S256 (RFC 7636 §4.2): only the verifier's hash goes out now.
  const codeChallenge = createHash("sha256").update(transaction.codeVerifier).digest("base64url");

  // The authorization request (RFC 6749 §4.1.1). Everything in it travels
  // through the browser, so nothing in it is secret.
  const authorizeUrl = new URL("/oauth/authorize", AUTH_SERVER_PUBLIC_URL);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    scope: OAUTH_SCOPE,
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  // Keep the three values until the callback, in a cookie no script can read.
  // `lax` still sends it on the top-level GET back from the provider.
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("oauth_transaction", JSON.stringify(transaction), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
};
