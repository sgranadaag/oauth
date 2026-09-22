import { randomBytes } from 'node:crypto';

/**
 * Generates an unguessable value for a bearer credential: a refresh token, an
 * authorization code, an interaction id.
 *
 * Drawn from `crypto.randomBytes`, a CSPRNG, and encoded base64url so it can
 * travel in a URL or a form body untouched. Whoever holds one of these values
 * can use it, so the byte length is the whole of its security — 32 bytes
 * (256 bits) is what every caller in this server passes.
 *
 * @param byteLength - How many random bytes to draw before encoding.
 * @returns The base64url encoding of those bytes.
 */
export function createRandomValue(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url');
}
