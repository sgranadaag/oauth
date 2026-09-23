import { createPublicKey, verify, type JsonWebKey } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import type {
  AuthorizationTransaction,
  IdTokenClaims,
  Session,
  TokenResponse,
} from "@shared/auth.types";

// How long this app's own session cookie lives. Longer than an access token,
// so the refresh token inside it is still there to be used; shorter than the
// provider's refresh window, so a dead session cleans itself up.
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

// GET /api/auth/callback — the browser comes back from the provider with
// `code` and `state`, or with `error`. Everything below runs on this server.
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const {
    AUTH_SERVER_URL = "http://localhost:3000",
    OAUTH_ISSUER = "http://localhost:3000",
    OAUTH_CLIENT_ID = "",
    OAUTH_CLIENT_SECRET = "",
    OAUTH_REDIRECT_URI = "http://localhost:3001/api/auth/callback",
  } = process.env;
  const { searchParams } = request.nextUrl;

  // This app's own address. Taken from the redirect URI, never from
  // `request.nextUrl.origin`: in a container Next builds that from the
  // address it binds to, which is `0.0.0.0` — a URL no browser can follow.
  const { origin } = new URL(OAUTH_REDIRECT_URI);

  // Every outcome ends on the home page, and the one-time transaction cookie goes.
  const finish = (error?: string): NextResponse => {
    const home = new URL("/", origin);
    if (error) home.searchParams.set("error", error);

    const response = NextResponse.redirect(home);
    response.cookies.delete("oauth_transaction");

    return response;
  };

  // 1. The provider refused (e.g. `access_denied`): show why.
  const providerError = searchParams.get("error");
  if (providerError) {
    return finish(providerError);
  }

  // 2. Only answer a sign-in this browser started: the `state` must match the
  //    cookie. A forged callback carrying an attacker's code has no match.
  let transaction: AuthorizationTransaction | null = null;
  try {
    transaction = JSON.parse(request.cookies.get("oauth_transaction")?.value ?? "null");
  } catch {
    transaction = null;
  }

  const code = searchParams.get("code");
  if (!code || !transaction || searchParams.get("state") !== transaction.state) {
    return finish("state_mismatch");
  }

  // 3. Exchange the code, server to server (RFC 6749 §4.1.3). The client
  //    secret and the PKCE verifier travel here and nowhere else.
  let tokens: TokenResponse;
  try {
    const tokenResponse = await fetch(new URL("/oauth/token", AUTH_SERVER_URL), {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: OAUTH_REDIRECT_URI,
        code_verifier: transaction.codeVerifier,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      return finish("sign_in_failed");
    }
    tokens = (await tokenResponse.json()) as TokenResponse;
  } catch {
    return finish("sign_in_failed");
  }

  // 4. Verify the ID token before believing a word of it (OIDC Core §3.1.3.7).
  //    A JWT is `header.payload.signature`, each part base64url.
  const [encodedHeader, encodedPayload, encodedSignature] = tokens.id_token?.split(".") ?? [];
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return finish("sign_in_failed");
  }

  let header: { alg?: string; kid?: string };
  let claims: IdTokenClaims;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return finish("sign_in_failed");
  }

  // 4a. Only RS256. The token must never pick its own algorithm: `none` or a
  //     symmetric HS256 are the classic ways to forge one.
  if (header.alg !== "RS256" || !header.kid) {
    return finish("sign_in_failed");
  }

  // 4b. Fetch the provider's public keys (JWKS, RFC 7517) and take the one the
  //     token names by `kid`. A real client would cache this.
  let jwk: JsonWebKey | undefined;
  try {
    const jwksResponse = await fetch(new URL("/oauth/jwks", AUTH_SERVER_URL), { cache: "no-store" });
    if (!jwksResponse.ok) {
      return finish("sign_in_failed");
    }
    const { keys } = (await jwksResponse.json()) as { keys: JsonWebKey[] };
    jwk = keys.find((key) => key.kid === header.kid);
  } catch {
    return finish("sign_in_failed");
  }

  if (!jwk) {
    return finish("sign_in_failed");
  }

  // 4c. The signature covers `header.payload` exactly as received. RS256 is
  //     RSA PKCS#1 v1.5 over SHA-256, which is Node's default for an RSA key.
  const isSignedByProvider = verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url")
  );

  if (!isSignedByProvider) {
    return finish("sign_in_failed");
  }

  // 4d. Signed by the provider — now check it was minted for this sign-in:
  //     issuer, this client as audience, not expired, and the nonce from step 1.
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const isForThisSignIn =
    claims.iss === OAUTH_ISSUER &&
    audiences.includes(OAUTH_CLIENT_ID) &&
    claims.exp * 1000 > Date.now() &&
    claims.nonce === transaction.nonce;

  if (!isForThisSignIn) {
    return finish("sign_in_failed");
  }

  // 5. Keep the session in an httpOnly cookie: the tokens, and when the
  //    access token dies. The email comes from the ID token, which is what it
  //    is for.
  const session: Session = {
    email: claims.email,
    scope: tokens.scope,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? "",
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  const response = finish();
  // The cookie outlives the access token on purpose: it carries the refresh
  // token, and a session that vanished at `expires_in` could never be renewed.
  response.cookies.set("session", JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
};
