export const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL ?? "http://localhost:3000";
export const ISSUER = process.env.NEXT_PUBLIC_OAUTH_ISSUER ?? "http://localhost:3000";
export const REDIRECT_URI =
  process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ?? "http://localhost:3001/callback";
export const PUBLIC_KEY_URL = "/public.pem";

export const CLIENT_ID = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID ?? "";
export const SCOPE = process.env.NEXT_PUBLIC_OAUTH_SCOPE ?? "read write";
export const NO_PROMPT = "none";
export const RANDOM_BYTES = 32;

export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
