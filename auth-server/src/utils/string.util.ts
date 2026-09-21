import { timingSafeEqual } from 'node:crypto';

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
 * sizes. It leaks the length, which is fine while every value compared here has
 * a fixed, public one; if it ever isn't, hash both sides and compare digests.
 *
 * Hashed values skip this: bcrypt already compares in constant time, so
 * passwords go through `@utils/password.util`.
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
