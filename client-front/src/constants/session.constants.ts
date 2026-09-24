/** Where the session lives between page loads, per tab. */
export const SESSION_KEY = "session";

/** Where `state`, `nonce` and the PKCE verifier wait for the callback. */
export const TRANSACTION_KEY = "transaction";

// What the pages can say went wrong. Deliberately coarse: telling a bad
// signature from a bad nonce would only help whoever is trying them.
export const SIGN_IN_FAILED = "sign_in_failed";

export const STATE_MISMATCH = "state_mismatch";

export const SESSION_EXPIRED = "session_expired";
