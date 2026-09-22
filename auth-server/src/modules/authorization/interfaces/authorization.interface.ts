export interface CreateAuthorizationRequestInput {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  nonce?: string;
  codeChallenge: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}
