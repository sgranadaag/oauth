import { timingSafeEqual } from 'node:crypto';

/**
 * Checks a submitted one-time password against the issued one, in constant
 * time.
 *
 * A plain `===` returns as soon as a digit differs, so response latency would
 * reveal how many leading digits a guess got right. `timingSafeEqual` throws on
 * differing lengths, hence the explicit length check first — that leaks the
 * length only, which is fixed and public anyway.
 *
 * @param submittedOtp - The code the caller presented.
 * @param storedOtp - The code issued for that user.
 * @returns `true` when both codes are identical, `false` otherwise. Never
 *   throws on a mismatch — callers decide what a failure means.
 */
export function otpMatches(submittedOtp: string, storedOtp: string): boolean {
  const submittedBuffer = Buffer.from(submittedOtp, 'utf8');
  const storedBuffer = Buffer.from(storedOtp, 'utf8');

  return (
    submittedBuffer.length === storedBuffer.length &&
    timingSafeEqual(submittedBuffer, storedBuffer)
  );
}
