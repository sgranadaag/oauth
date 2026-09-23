export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;

  idp?: string;
}

export interface InteractionDetails {
  clientName: string;
  scope: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface InteractionAcceptResult {
  redirectTo: string;
}
