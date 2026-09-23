import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// RSA-2048 is stated explicitly rather than left to a library default, so the key
// size is an auditable choice here.
const MODULUS_LENGTH = 2048;

function main(): void {
  // PKCS#1 PEM ("BEGIN RSA PRIVATE KEY" / "BEGIN RSA PUBLIC KEY") is the only
  // format written. It is what this app signs and verifies with
  // (src/utils/jwt.util.ts) and what external tooling expects (openssl, jwt.io,
  // other languages' crypto libraries).
  //
  // No .jwk.json files: oidc-provider's `jwks` config needs JWK objects, but
  // oidcProvider.factory.ts derives those from this PEM at boot with
  // crypto.createPrivateKey(...).export({ format: 'jwk' }), so the PEM stays the
  // single source of truth for the key pair.
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: MODULUS_LENGTH,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  const secretsDir = join(__dirname, '..', 'src', 'core', 'secrets');
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
