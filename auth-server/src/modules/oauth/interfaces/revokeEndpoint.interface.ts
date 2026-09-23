// The contract of `POST /oauth/revoke` (RFC 7009), form-encoded like the token
// endpoint. There is no response body: the answer is a 200, always.
export interface RevokeRequestParams {
  token?: string;
  // `access_token` or `refresh_token`. A hint, not a promise — §2.1 lets the
  // server search the other type anyway, and this one only stores refresh
  // tokens, so nothing here changes what is looked up.
  token_type_hint?: string;
}
