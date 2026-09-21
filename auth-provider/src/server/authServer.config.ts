import "server-only";

/**
 * Where the auth server is and who this app is to it.
 *
 * `server-only` at the top is the boundary itself: importing this file from a
 * browser bundle fails the build instead of shipping the client secret.
 */
export const AUTH_SERVER_CONFIG = {
  baseUrl: process.env.AUTH_SERVER_URL ?? "http://localhost:3000",
  tokenEndpoint: "/oauth/token",
  clientId: process.env.OAUTH_CLIENT_ID ?? "",
  clientSecret: process.env.OAUTH_CLIENT_SECRET ?? "",
} as const;
