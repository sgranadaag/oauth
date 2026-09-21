import * as bcrypt from 'bcryptjs';

/**
 * bcrypt cost factor. 12 is roughly 600ms per hash on current hardware —
 * slow on purpose, and the reason `test/jest-e2e.json` raises Jest's timeout.
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password for storage.
 *
 * bcrypt embeds the salt and the cost factor in the digest, so nothing else
 * needs storing alongside it and raising `SALT_ROUNDS` later leaves existing
 * hashes verifiable.
 *
 * @param password - The plaintext password as submitted.
 * @returns The bcrypt digest, safe to persist as `UserEntity.passwordHash`.
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Checks a submitted password against a stored bcrypt digest.
 *
 * bcrypt's own comparison is constant-time for a given digest, so this needs
 * no `timingSafeEqual` wrapper the way a plaintext client secret does. The
 * cost factor is read from the digest, not from `SALT_ROUNDS`.
 *
 * @param password - The plaintext password as submitted.
 * @param passwordHash - The stored digest to check it against.
 * @returns `true` when the password matches, `false` otherwise. Never throws
 *   on a mismatch — callers decide what a failure means.
 */
export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
