// The contract of `POST /oauth/token`, in RFC 6749 vocabulary — the request as
// it arrives and the response as it goes back. What happens in between is the
// token module's business, in its own names.

// Whatever the client posted, before any grant has claimed it: one route serves
// every grant, so only `grant_type` is common. Each grant narrows it through
// its own params type.
export interface TokenRequestParams {
  grant_type?: string;
  scope?: string;
  [param: string]: string | undefined;
}

// RFC 6749 §5.1, plus OpenID Connect's `id_token` when `openid` was granted.
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}
