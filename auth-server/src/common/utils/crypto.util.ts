import { randomBytes, timingSafeEqual } from 'node:crypto';

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

/**
 * Compares two strings in constant time — for any value where the caller
 * submits the guess, such as a client secret or a one-time password.
 *
 * `===` stops at the first differing byte, so its timing reveals how many
 * leading characters a guess got right: that turns a 6-digit code from a
 * million combinations into sixty attempts. `timingSafeEqual` always walks both
 * buffers, so only the length shows.
 *
 * The length check comes first because `timingSafeEqual` throws on different
 * lengths. Leaking the length is acceptable here, since what it compares is
 * a fixed, public one; if it ever isn't, hash both sides and compare digests.
 *
 * Hashed values skip this: bcrypt already compares in constant time, and
 * passwords are the identity side's to check, never the oauth side's.
 *
 * @param value - The string the caller submitted.
 * @param expected - The string it is checked against.
 * @returns `true` when both are identical, `false` otherwise. Never throws on
 *   a mismatch — callers decide what a failure means.
 */
export function constantTimeEquals(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}
