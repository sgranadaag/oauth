// Everything here reaches the browser: this is a public client, so none of it
// is secret. The `NEXT_PUBLIC_` prefix is what makes Next inline the values at
// build time — without it they would be `undefined` in the page.
export const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL ?? "http://localhost:3000";

export const ISSUER = process.env.NEXT_PUBLIC_OAUTH_ISSUER ?? "http://localhost:3000";

export const CLIENT_ID = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID ?? "";

export const REDIRECT_URI =
  process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ?? "http://localhost:3001/callback";

export const SCOPE = process.env.NEXT_PUBLIC_OAUTH_SCOPE ?? "read write";

/**
 * The provider's public key, copied into this app rather than fetched.
 *
 * `GET /oauth/jwks` publishes the same key and is the right source in a real
 * client — it survives a key rotation, which this file does not. Kept as a
 * copy here only to show the verification without a second round trip.
 */
export const PUBLIC_KEY_URL = "/public.pem";

/** 256 bits for `state` — RFC 6749 §10.12. */
export const RANDOM_BYTES = 32;

export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
