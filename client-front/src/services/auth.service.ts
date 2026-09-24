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
  markSilentSignInTried,
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
 * Starts a sign-in: stores a fresh `state` and returns the URL to leave for.
 *
 * @param prompt - `NO_PROMPT` to ask silently, without a login page.
 * @returns The authorization URL to navigate to.
 */
export const buildAuthorizeUrl = (prompt?: string): string => {
  const state = randomValue();
  storeTransaction({ state });

  const query = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
  });
  if (prompt) query.set("prompt", prompt);

  const authorizeUrl = new URL("/oauth/authorize", AUTH_SERVER_URL);
  authorizeUrl.search = query.toString();

  return authorizeUrl.toString();
};

/**
 * Verifies an access token against the provider's public key.
 *
 * @returns `true` only for an RS256 signature this app can check.
 */
const isSignedByProvider = async (accessToken: string): Promise<boolean> => {
  const [encodedHeader, encodedPayload, encodedSignature] = accessToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return false;

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
 * Completes a sign-in, from `?code` to a stored session.
 *
 * @param params - The query the provider sent the browser back with.
 * @returns `null` when the person is signed in, or the reason it failed.
 */
export const completeSignIn = async (params: URLSearchParams): Promise<string | null> => {
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
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: session.refreshToken,
        token_type_hint: "refresh_token",
        client_id: CLIENT_ID,
      }),
    });
  } catch {}

  clearSession();
  markSilentSignInTried();
};
