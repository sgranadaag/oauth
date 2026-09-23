import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type {
  AccessTokenClaims,
  SignAccessTokenOptions,
} from '@modules/oauth/token/interfaces/accessToken.interface';
import type {
  IdTokenClaims,
  SignIdTokenOptions,
} from '@modules/oauth/token/interfaces/idToken.interface';
import {
  SIGNING_ALGORITHM,
  getPrivateKeyPem,
  getSigningKeyId,
} from '@modules/oauth/token/utils/keys.util';

/** RFC 9068 media type for a JWT access token, stamped on the `typ` header. */
export const ACCESS_TOKEN_TYP = 'at+jwt';

/**
 * Signs a JWT access token with the server's private key.
 *
 * RS256, `typ: at+jwt`, `kid` naming the key in `GET /oauth/jwks`, with
 * `iss`, `aud`, `iat` and `exp` derived from `options`. A fresh `jti` is generated per call rather than taken from
 * `claims` — RFC 9068 §2.2 requires one, and generating it here means no caller
 * can mint two tokens sharing an identifier. `TokenService` is its only caller,
 * so signing and verification stay defined against the same key pair, here.
 *
 * @param claims - Token claims to embed. `iss`, `aud`, `iat`, `exp` and `jti`
 *   are excluded: the first four come from `options`, the last is generated.
 * @param options - `issuer` and `audience` to stamp on the token, and
 *   `expiresInSeconds` for its lifetime.
 * @returns The signed, compact-serialised JWT.
 * @throws If `src/core/secrets/private.pem` cannot be read.
 */
export function signAccessToken(
  claims: Omit<AccessTokenClaims, 'iss' | 'aud' | 'iat' | 'exp' | 'jti'>,
  options: SignAccessTokenOptions,
): string {
  return jwt.sign(claims, getPrivateKeyPem(), {
    algorithm: SIGNING_ALGORITHM,
    issuer: options.issuer,
    audience: options.audience,
    expiresIn: options.expiresInSeconds,
    jwtid: randomUUID(),
    header: {
      alg: SIGNING_ALGORITHM,
      typ: ACCESS_TOKEN_TYP,
      kid: getSigningKeyId(),
    },
  });
}

/**
 * Signs an OpenID Connect ID token with the server's private key.
 *
 * Tells the client *who signed in*, which an access token does not: an access
 * token is addressed to an API, an ID token to the client itself — hence `aud`
 * is the `client_id` and `typ` stays `JWT`, so neither can be mistaken for the
 * other. Same key, algorithm and `kid` as access tokens: the client verifies
 * the signature against `GET /oauth/jwks`.
 *
 * @param claims - `sub`, `email` and, when the client sent one, `nonce`.
 * @param options - `issuer`, the `clientId` the token is addressed to, and
 *   `expiresInSeconds` for its lifetime.
 * @returns The signed, compact-serialised JWT.
 * @throws If `src/core/secrets/private.pem` cannot be read.
 */
export function signIdToken(
  claims: Pick<IdTokenClaims, 'sub' | 'email' | 'nonce'>,
  options: SignIdTokenOptions,
): string {
  return jwt.sign(claims, getPrivateKeyPem(), {
    algorithm: SIGNING_ALGORITHM,
    issuer: options.issuer,
    audience: options.clientId,
    expiresIn: options.expiresInSeconds,
    header: { alg: SIGNING_ALGORITHM, typ: 'JWT', kid: getSigningKeyId() },
  });
}

