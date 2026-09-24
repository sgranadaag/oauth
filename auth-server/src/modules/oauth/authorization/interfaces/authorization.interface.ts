export interface CreateRequestInput {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
}

export interface CodeSubject {
  id: string;
  email: string;
}
