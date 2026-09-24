export interface TokenRequestParams {
  grant_type?: string;
  scope?: string;
  [param: string]: string | undefined;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}
