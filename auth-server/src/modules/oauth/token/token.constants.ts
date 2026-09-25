export const DEFAULT_ISSUER = 'http://localhost:3000';

export const DEFAULT_AUDIENCE = 'urn:oauth:default';

export const ACCESS_TOKEN_TTL_SECONDS = 3600;

export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const REFRESH_TOKEN_BYTES = 32;

export const REFRESH_TOKEN_TYPE = 'refresh';

export const TOKEN_TYPE_HINTS: string[] = ['access_token', 'refresh_token'];
