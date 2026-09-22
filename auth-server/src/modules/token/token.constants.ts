export const DEFAULT_ISSUER = 'http://localhost:3000';

// The `aud` of every access token: the identifier of the API these tokens are
// good for, and what a resource server must check when it verifies one.
export const DEFAULT_AUDIENCE = 'urn:oauth:default';

export const ACCESS_TOKEN_TTL_SECONDS = 3600;

export const ID_TOKEN_TTL_SECONDS = 3600;

export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

// The fixed end of a session, counted from sign-in and never extended by
// rotation. Past it the person goes back through the login app, which is where
// the identity side vouches for them again — the oauth side never asks.
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

// Bytes of randomness behind a refresh token. The value is the only thing
// making it unguessable: nothing is derived from it and nothing is signed.
export const REFRESH_TOKEN_BYTES = 32;

export const REFRESH_TOKEN_TYPE = 'refresh';
