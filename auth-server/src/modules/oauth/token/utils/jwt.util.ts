import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type {
  AccessTokenClaims,
  SignAccessTokenOptions,
} from '@modules/oauth/token/interfaces/accessToken.interface';
import {
  SIGNING_ALGORITHM,
  getPrivateKeyPem,
  getSigningKeyId,
} from '@modules/oauth/token/utils/keys.util';

/** RFC 9068 media type, stamped on the `typ` header of an access token. */
export const ACCESS_TOKEN_TYP = 'at+jwt';

/**
 * Signs an access token — **the only place this server signs anything**.
 *
 * A second signing path is a second thing to keep in sync with the key, the
 * algorithm and the `kid`, and the first to drift. Verification is
 * deliberately absent: it belongs to whoever *accepts* the token, offline,
 * against `GET /oauth/jwks`.
 *
 * The header carries `kid` so a verifier can pick the right key out of the
 * JWK Set without guessing, and `alg` explicitly so nothing downstream has to
 * infer it — a verifier that trusts the token's own `alg` will accept `none`.
 *
 * @param claims - What the token asserts. `iss`, `aud`, `iat`, `exp` and
 *   `jti` are not passed: they are stamped here so every token agrees.
 * @param options - Issuer, audience and lifetime, supplied by the caller
 *   because they are configuration, not a property of the claims.
 * @returns The signed compact JWT.
 * @throws If `secrets/private.pem` cannot be read.
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
