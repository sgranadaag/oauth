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
