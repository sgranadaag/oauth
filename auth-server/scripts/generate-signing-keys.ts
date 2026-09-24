import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// RSA-2048 is stated explicitly rather than left to a library default, so the key
// size is an auditable choice here.
const MODULUS_LENGTH = 2048;

function main(): void {
  // The two halves are written in different formats on purpose.
  //
  // Private: PKCS#1 ("BEGIN RSA PRIVATE KEY"), which jsonwebtoken signs with
  // directly and openssl, jwt.io and other languages' crypto libraries all
  // read.
  //
  // Public: SPKI ("BEGIN PUBLIC KEY"), because client-front verifies tokens
  // in the browser and `crypto.subtle.importKey` accepts SPKI and nothing
  // else — never PKCS#1. Node's createPublicKey() reads both, so the JWKS
  // endpoint is indifferent; the browser is not. Writing SPKI here is what
  // makes client-front/public/public.pem a plain copy of this file instead of
  // a conversion step someone has to remember.
  //
  // No .jwk.json files: the JWK Set is derived from public.pem at request
  // time (token/utils/keys.util.ts), so the PEM stays the single source of
  // truth for the key pair.
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: MODULUS_LENGTH,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  const secretsDir = join(__dirname, '..', 'secrets');
  mkdirSync(secretsDir, { recursive: true });

  writeFileSync(join(secretsDir, 'private.pem'), privateKey);
  writeFileSync(join(secretsDir, 'public.pem'), publicKey);

  console.log(
    `RSA-${MODULUS_LENGTH} signing key pair written to ${secretsDir}\n` +
      '  private.pem — signs access tokens; never leaves the server\n' +
      '  public.pem  — verifies them; safe to publish',
  );
}

main();
