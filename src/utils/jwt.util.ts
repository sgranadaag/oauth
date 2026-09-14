import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type {
  AccessTokenClaims,
  SignAccessTokenOptions,
  VerifyAccessTokenOptions,
} from '@interfaces/accessToken.interface';
import {
  SIGNING_ALGORITHM,
  getPrivateKeyPem,
  getPublicKeyPem,
} from '@utils/keys.util';

/** RFC 9068 media type for a JWT access token, stamped on the `typ` header. */
export const ACCESS_TOKEN_TYP = 'at+jwt';

/**
 * Signs a JWT access token with the server's private key.
 *
 * Produces the same shape `oidc-provider` issues: RS256, `typ: at+jwt`, with
 * `iss`, `aud`, `iat` and `exp` derived from `options`. A fresh `jti` is
 * generated per call rather than taken from `claims` — RFC 9068 §2.2 requires
 * one, and generating it here means no caller can mint two tokens sharing an
 * identifier. Nothing in the request path calls this today: `/oauth/token` is
 * the only issuer, and the library mints its own. It exists so signing and
 * verification stay defined against the same key pair, in one place.
 *
 * @param claims - Token claims to embed. `iss`, `aud`, `iat`, `exp` and `jti`
 *   are excluded: the first four come from `options`, the last is generated.
 * @param options - `issuer` and `audience` to stamp on the token, and
 *   `expiresInSeconds` for its lifetime.
 * @returns The signed, compact-serialised JWT.
 * @throws If `src/secrets/private.pem` cannot be read.
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
    header: { alg: SIGNING_ALGORITHM, typ: ACCESS_TOKEN_TYP },
  });
}

/**
 * Verifies a JWT access token against the server's public key.
 *
 * Checks the RS256 signature, expiry, issuer, audience, and that the `typ`
 * header is `at+jwt` — the last of these explicitly, since `jsonwebtoken` does
 * not assert `typ` on its own and an id_token signed with the same key would
 * otherwise pass as an access token. Verification is entirely offline: no
 * database read and no call into `oidc-provider`, which is the property any
 * third party holding `public.pem` relies on. A token revoked through
 * `POST /oauth/token/revocation` therefore still verifies here until its
 * `exp` — revocation ends the *session* by consuming the grant, it cannot
 * reach a JWT already in someone's hands.
 *
 * @param token - The compact-serialised JWT, without the `Bearer ` prefix.
 * @param options - The `issuer` and `audience` the token must have been minted for.
 * @returns The verified claims.
 * @throws {jwt.JsonWebTokenError} If the signature, issuer, audience or `typ` is wrong.
 * @throws {jwt.TokenExpiredError} If the token has expired.
 */
export function verifyAccessToken(
  token: string,
  options: VerifyAccessTokenOptions,
): AccessTokenClaims {
  const decoded = jwt.verify(token, getPublicKeyPem(), {
    algorithms: [SIGNING_ALGORITHM],
    issuer: options.issuer,
    audience: options.audience,
    complete: true,
  });

  if (decoded.header.typ !== ACCESS_TOKEN_TYP) {
    throw new jwt.JsonWebTokenError(
      `unexpected token typ, expected ${ACCESS_TOKEN_TYP}`,
    );
  }

  return decoded.payload as AccessTokenClaims;
}
