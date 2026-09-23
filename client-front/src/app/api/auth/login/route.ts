import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import type { AuthorizationTransaction } from "@shared/auth.types";


export const GET = (): NextResponse => {
  const {
    AUTH_SERVER_URL = "http://localhost:3000",
    AUTH_SERVER_PUBLIC_URL = AUTH_SERVER_URL,
    OAUTH_CLIENT_ID = "",
    OAUTH_REDIRECT_URI = "http://localhost:3001/api/auth/callback",
    OAUTH_SCOPE = "openid read write",
  } = process.env;

  const transaction: AuthorizationTransaction = {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    codeVerifier: randomBytes(32).toString("base64url"),
  };

  const codeChallenge = createHash("sha256").update(transaction.codeVerifier).digest("base64url");

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
