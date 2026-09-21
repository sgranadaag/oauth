import type { LoginCredentials, Session, TokenRequest, TokenResponse } from "@shared/auth.types";

/**
 * Credentials as the form holds them -> the body the token endpoint expects.
 *
 * The email travels as `username` because that is the parameter name RFC 6749
 * §4.3.2 fixes for this grant, whatever the server stores behind it.
 */
export const toTokenRequest = ({ email, password }: LoginCredentials): TokenRequest => ({
  grant_type: "password",
  username: email,
  password,
});

/**
 * Token response -> what the screen is allowed to see.
 *
 * The refresh token is dropped on purpose: it outlives the access token, so
 * handing it to a browser would turn a leak into a lasting one.
 */
export const toSession = ({ access_token, expires_in, scope }: TokenResponse): Session => ({
  accessToken: access_token,
  expiresIn: expires_in,
  scope,
});
