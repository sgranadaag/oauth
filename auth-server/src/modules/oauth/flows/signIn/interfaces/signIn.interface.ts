export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  prompt?: string;
}

export interface InteractionDetails {
  clientId: string;
  clientName: string;
  scope: string;
}
