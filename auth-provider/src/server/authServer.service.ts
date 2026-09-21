import "server-only";

import { toTokenRequest } from "@adapters/login.adapter";
import { AUTH_SERVER_CONFIG } from "@server/authServer.config";
import type { LoginCredentials, TokenResponse } from "@shared/auth.types";

export class AuthServerError extends Error {
  constructor(readonly status: number) {
    super(`auth server answered ${status}`);
  }
}

const basicAuthHeader = (): string => {
  const { clientId, clientSecret } = AUTH_SERVER_CONFIG;

  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
};

/**
 * Exchanges a user's credentials for tokens.
 *
 * The only place this app talks to the auth server, and the only place the
 * client secret is read. RFC 6749 §4.3.2 posts the credentials as
 * `application/x-www-form-urlencoded`.
 */
export const requestToken = async (credentials: LoginCredentials): Promise<TokenResponse> => {
  const { baseUrl, tokenEndpoint } = AUTH_SERVER_CONFIG;

  const response = await fetch(`${baseUrl}${tokenEndpoint}`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...toTokenRequest(credentials) }).toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AuthServerError(response.status);
  }

  return (await response.json()) as TokenResponse;
};

export const hasClientCredentials = (): boolean =>
  Boolean(AUTH_SERVER_CONFIG.clientId && AUTH_SERVER_CONFIG.clientSecret);
