export interface CreateCodeRequestInput {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  nonce?: string;
  codeChallenge: string;
}

export interface CodeSubject {
  id: string;
  email: string;
}
