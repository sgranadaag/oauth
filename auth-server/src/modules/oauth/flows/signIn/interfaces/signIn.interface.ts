export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface InteractionDetails {
  clientName: string;
  scope: string;
}

export interface SignInResult {
  redirectTo: string;
  sessionId?: string;
}
