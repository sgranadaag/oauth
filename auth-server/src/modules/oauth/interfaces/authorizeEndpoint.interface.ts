// The contract of the front channel: `GET /oauth/authorize`, reached through
// the person's browser, and the interaction endpoints the provider's login app
// calls, server to server, while the person signs in.

// RFC 6749 §4.1.1 plus RFC 7636 (PKCE) and OpenID Connect's `nonce`.
export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  // Not an RFC parameter: which identity provider should authenticate the
  // person. A key of `IDENTITY_PROVIDERS`; absent means the default one.
  idp?: string;
}

// What the login page shows while the person decides: who is asking, for what.
export interface InteractionDetails {
  clientName: string;
  scope: string;
}

// Where the browser goes once the person has signed in: back to the client,
// carrying the code.
export interface InteractionAcceptResult {
  redirectTo: string;
}
