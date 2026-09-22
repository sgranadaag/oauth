/**
 * The moment a given number of seconds from now — an expiry to store on a
 * short-lived document.
 *
 * @param seconds - The lifetime, in seconds.
 * @returns A `Date` that far in the future.
 */
export function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Whether an expiry has been reached.
 *
 * The boundary counts as expired: a value is valid strictly *before* its
 * expiry, never at it.
 *
 * @param expiresAt - The stored expiry.
 * @returns `true` once `expiresAt` is now or in the past.
 */
export function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}
