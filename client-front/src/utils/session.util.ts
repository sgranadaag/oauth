import { SESSION_KEY, TRANSACTION_KEY } from "@constants/session.constants";
import type { AuthorizationTransaction, Session } from "@shared/auth.types";

/**
 * Reads a JSON value out of `sessionStorage`.
 *
 * Every access goes through here because `sessionStorage` is not always
 * there: a private window, blocked site data or a disabled storage policy
 * make the accessor itself throw, and stored JSON can be anything a script
 * put there. Both failures mean the same thing to a caller — nothing stored —
 * so neither is allowed to escape.
 */
const read = <T>(key: string): T | null => {
  try {
    const stored = sessionStorage.getItem(key);

    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is unavailable; the flow still works for this page load.
  }
};

const clear = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to remove if nothing could be stored.
  }
};

/** The session stored by the callback, or `null` when nobody is signed in. */
export const readSession = (): Session | null => read<Session>(SESSION_KEY);

/** @returns The session it was given, so callers can store and use in one step. */
export const storeSession = (session: Session): Session => {
  write(SESSION_KEY, session);

  return session;
};

export const clearSession = (): void => clear(SESSION_KEY);

/**
 * Takes the pending transaction and removes it in the same step.
 *
 * It is single-use by construction: reading it twice would mean two codes
 * being exchanged against one `state`, and the second must not succeed.
 */
export const takeTransaction = (): AuthorizationTransaction | null => {
  const transaction = read<AuthorizationTransaction>(TRANSACTION_KEY);
  clear(TRANSACTION_KEY);

  return transaction;
};

export const storeTransaction = (transaction: AuthorizationTransaction): void =>
  write(TRANSACTION_KEY, transaction);
