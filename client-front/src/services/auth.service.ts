import {
  AUTH_SERVER_URL,
  CLIENT_ID,
  ISSUER,
  MILLISECONDS_PER_SECOND,
  PUBLIC_KEY_URL,
  REDIRECT_URI,
  SCOPE,
} from "@constants/auth.constants";
import { SIGN_IN_FAILED, STATE_MISMATCH } from "@constants/session.constants";
import {
  decodeJwtSegment,
  fromBase64Url,
  importPublicKey,
  randomValue,
} from "@utils/crypto.util";
import {
  clearSession,
  storeSession,
  storeTransaction,
  takeTransaction,
} from "@utils/session.util";
import type {
  AccessTokenClaims,
  JwtHeader,
  Session,
  TokenResponse,
} from "@shared/auth.types";

/**
 * Step 1: one unguessable value, kept here, and the URL to leave for.
 *
 * Plain RFC 6749 §4.1.1 — no PKCE. `state` is the whole of this client's
 * protection: it proves the callback answers a request this browser started,
 * and nothing else stands between a stolen code and a token.
 */
export const buildAuthorizeUrl = (): string => {
  const state = randomValue();
  storeTransaction({ state });

  const authorizeUrl = new URL("/oauth/authorize", AUTH_SERVER_URL);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
  }).toString();

  return authorizeUrl.toString();
};

/**
 * Is this access token really the provider's?
 *
 * The key is the copy bundled with this app. `GET /oauth/jwks` publishes the
 * same one by `kid` and is what a real client would read, because it survives
 * a rotation — this copy does not.
 */
const isSignedByProvider = async (accessToken: string): Promise<boolean> => {
  const [encodedHeader, encodedPayload, encodedSignature] = accessToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return false;

  // RS256 only: honouring the token's own `alg` would honour `none`.
  const header = decodeJwtSegment<JwtHeader>(encodedHeader);
  if (header.alg !== "RS256") return false;

  const response = await fetch(PUBLIC_KEY_URL, { cache: "no-store" });
  if (!response.ok) return false;

  const publicKey = await importPublicKey(await response.text());

  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    fromBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
};

/**
 * Step 2: the return leg, from `?code` to a stored session.
 *
 * @param params - The query the provider sent the browser back with.
 * @returns `null` when the person is signed in, or the reason it failed.
 */
export const completeSignIn = async (params: URLSearchParams): Promise<string | null> => {
  // The provider may be reporting a refusal instead of a code.
  const providerError = params.get("error");
  if (providerError) return providerError;

  const transaction = takeTransaction();
  if (!transaction) return SIGN_IN_FAILED;

  const code = params.get("code");
  if (!code || params.get("state") !== transaction.state) return STATE_MISMATCH;

  let tokens: TokenResponse;
  try {
    const response = await fetch(new URL("/oauth/token", AUTH_SERVER_URL), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
      }),
    });
    if (!response.ok) return SIGN_IN_FAILED;

    tokens = (await response.json()) as TokenResponse;
  } catch {
    return SIGN_IN_FAILED;
  }

  const isTrustworthy = await isSignedByProvider(tokens.access_token);
  if (!isTrustworthy) return SIGN_IN_FAILED;

  // Only a verified signature makes the claims worth reading.
  const claims = decodeJwtSegment<AccessTokenClaims>(tokens.access_token.split(".")[1]);
  if (claims.iss !== ISSUER || claims.client_id !== CLIENT_ID) return SIGN_IN_FAILED;

  storeSession({
    subject: claims.sub,
    scope: tokens.scope,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? "",
    expiresAt: Date.now() + tokens.expires_in * MILLISECONDS_PER_SECOND,
  });

  return null;
};

/**
 * Trades the refresh token for a new pair. The person is never involved.
 *
 * @returns The renewed session, or `null` when the provider refused — which
 *   means the session is over, not that it hiccuped.
 */
export const renewSession = async (session: Session): Promise<Session | null> => {
  const response = await fetch(new URL("/oauth/token", AUTH_SERVER_URL), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const tokens = (await response.json()) as TokenResponse;

  return storeSession({
    ...session,
    scope: tokens.scope,
    accessToken: tokens.access_token,
    // Store the rotated token: presenting a spent one ends the session.
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * MILLISECONDS_PER_SECOND,
  });
};

/**
 * Ends the session here and at the provider (RFC 7009).
 *
 * Best effort on the provider's side: an unreachable server must not keep
 * someone signed in locally.
 */
export const endSession = async (session: Session): Promise<void> => {
  try {
    await fetch(new URL("/oauth/revoke", AUTH_SERVER_URL), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: session.refreshToken,
        token_type_hint: "refresh_token",
        client_id: CLIENT_ID,
      }),
    });
  } catch {
    // Dropped below regardless.
  }

  clearSession();
};
