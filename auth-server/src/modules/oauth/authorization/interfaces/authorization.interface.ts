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

export interface ClearedAuthorizationRecords {
  requests: number;
  codes: number;
}
