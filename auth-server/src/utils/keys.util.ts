import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JwkSet } from '@interfaces/jwks.interface';

/** JWS algorithm every token in this server is signed with. */
export const SIGNING_ALGORITHM = 'RS256';

const SECRETS_DIR = join(process.cwd(), 'src', 'secrets');

let privateKeyPem: string | undefined;
let publicKeyPem: string | undefined;
let signingJwks: JwkSet | undefined;

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
 * Derives the JSON Web Key Set for the signing key.
 *
 * The PEM on disk stays the single source of truth; the JWK form is derived in
 * memory and cached. `alg` and `use` are optional for RSA keys but set anyway,
 * to keep the key single-purpose.
 *
 * **Nothing calls this yet**: it is derived from the *private* key, so a JWKS
 * endpoint publishing it must strip the private half (`d`, `p`, `q`, `dp`,
 * `dq`, `qi`) and add a `kid` first. It is kept because verification currently
 * needs `public.pem` locally, and a third party will need this over HTTP.
 *
 * @returns A JWK Set holding the single RS256 signing key, private half included.
 * @throws If `src/secrets/private.pem` does not exist or is not a valid RSA key.
 */
export function getSigningJwks(): JwkSet {
  signingJwks ??= {
    keys: [
      {
        ...createPrivateKey(getPrivateKeyPem()).export({ format: 'jwk' }),
        alg: SIGNING_ALGORITHM,
        use: 'sig',
      },
    ],
  };
  return signingJwks;
}
