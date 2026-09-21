export const DEFAULT_ISSUER = 'http://localhost:3000';

// The `aud` of every access token, and what BearerTokenGuard requires when it
// verifies one: the identifier of the API these tokens are good for.
export const DEFAULT_AUDIENCE = 'urn:oauth:default';

export const ACCESS_TOKEN_TTL_SECONDS = 3600;

export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

// Bytes of randomness behind a refresh token. The value is the only thing
// making it unguessable: nothing is derived from it and nothing is signed.
export const REFRESH_TOKEN_BYTES = 32;

export const REFRESH_TOKEN_TYPE = 'refresh';
