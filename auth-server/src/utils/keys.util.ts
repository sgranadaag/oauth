import { createHash, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JwkSet } from '@interfaces/jwks.interface';

/** JWS algorithm every token in this server is signed with. */
export const SIGNING_ALGORITHM = 'RS256';

const SECRETS_DIR = join(process.cwd(), 'src', 'secrets');

let privateKeyPem: string | undefined;
let publicKeyPem: string | undefined;
let signingKeyId: string | undefined;
let publicJwks: JwkSet | undefined;

/**
 * Reads the private signing key from `src/secrets/private.pem`.
 *
 * PEM (PKCS#1) is the only on-disk key format, written by
 * `npm run generate-signing-keys`. The file is read once and cached for the
 * lifetime of the process.
 *
 * @returns The PKCS#1 PEM-encoded private key.
 * @throws If `src/secrets/private.pem` does not exist.
 */
export function getPrivateKeyPem(): string {
  privateKeyPem ??= readFileSync(join(SECRETS_DIR, 'private.pem'), 'utf8');
  return privateKeyPem;
}

/**
 * Reads the public signing key from `src/secrets/public.pem`.
 *
 * Safe to publish: this is the half a third party needs to verify a token
 * offline. Read once and cached for the lifetime of the process.
 *
 * @returns The PKCS#1 PEM-encoded public key.
 * @throws If `src/secrets/public.pem` does not exist.
 */
export function getPublicKeyPem(): string {
  publicKeyPem ??= readFileSync(join(SECRETS_DIR, 'public.pem'), 'utf8');
  return publicKeyPem;
}

/**
 * The signing key's id, `kid`: its RFC 7638 JWK thumbprint.
 *
 * SHA-256 over the key's required members (`e`, `kty`, `n`) serialised in
 * lexicographic order with no whitespace. Derived from the key itself, so it
 * changes exactly when the key does, and a verifier can pick the right key
 * out of the JWK Set without anyone assigning ids by hand. Cached after the
 * first call.
 *
 * @returns The base64url-encoded thumbprint.
 * @throws If `src/secrets/public.pem` does not exist or is not a valid RSA key.
 */
export function getSigningKeyId(): string {
  if (!signingKeyId) {
    const { e, kty, n } = createPublicKey(getPublicKeyPem()).export({
      format: 'jwk',
    });
    signingKeyId = createHash('sha256')
      .update(JSON.stringify({ e, kty, n }))
      .digest('base64url');
  }
  return signingKeyId;
}

/**
 * The JSON Web Key Set (RFC 7517) a verifier fetches: the signing key's
 * public half, and nothing else.
 *
 * Derived from `public.pem`, never from the private key, so no private member
 * (`d`, `p`, `q`, `dp`, `dq`, `qi`) can ever reach it. `kid` matches the
 * header of every token this server signs; `alg` and `use` pin the key to
 * RS256 signatures. Cached after the first call.
 *
 * @returns A JWK Set holding the single public RS256 signing key.
 * @throws If `src/secrets/public.pem` does not exist or is not a valid RSA key.
 */
export function getPublicJwks(): JwkSet {
  publicJwks ??= {
    keys: [
      {
        ...createPublicKey(getPublicKeyPem()).export({ format: 'jwk' }),
        kid: getSigningKeyId(),
        alg: SIGNING_ALGORITHM,
        use: 'sig',
      },
    ],
  };
  return publicJwks;
}
