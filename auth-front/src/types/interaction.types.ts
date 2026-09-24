/** What the auth server says about the sign-in in progress. */
export interface InteractionDetails {
  clientName: string;
  scope: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Where the browser goes once the person has signed in: back to the client. */
export interface LoginResult {
  redirectTo: string;
}

/**
 * What a sign-in attempt produced.
 *
 * A union rather than a nullable `redirectTo`: on failure there is no URL to
 * carry, and on success there is no reason — neither state can be built.
 */
export type SignInOutcome =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: string };
