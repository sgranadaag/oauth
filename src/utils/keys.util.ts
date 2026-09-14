import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JWK, JWKS } from 'oidc-provider';

/** JWS algorithm every token in this server is signed with. */
export const SIGNING_ALGORITHM = 'RS256';

const SECRETS_DIR = join(process.cwd(), 'src', 'secrets');

let privateKeyPem: string | undefined;
let publicKeyPem: string | undefined;
let signingJwks: JWKS | undefined;

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
 * Derives the JSON Web Key Set that `oidc-provider` requires for its `jwks`
 * configuration option.
 *
 * The library rejects a PEM string outright — it asserts the value is a JWK Set
 * object — but the file on disk need not be one, so the key is converted in
 * memory and the PEM stays the single source of truth. `kid` is deliberately
 * absent: the library fills it in with an RFC 7638 thumbprint, which is what
 * `GET /oauth/jwks` then publishes. `alg` and `use` are optional for RSA keys
 * but set anyway, to keep the key single-purpose. Derived once and cached.
 *
 * @returns A JWK Set holding the single RS256 signing key, private half included.
 * @throws If `src/secrets/private.pem` does not exist or is not a valid RSA key.
 */
export function getSigningJwks(): JWKS {
  signingJwks ??= {
    keys: [
      {
        ...(createPrivateKey(getPrivateKeyPem()).export({
          format: 'jwk',
        }) as JWK),
        alg: SIGNING_ALGORITHM,
        use: 'sig',
      },
    ],
  };
  return signingJwks;
}
