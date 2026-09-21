// `username` is the RFC 6749 §4.3.2 parameter name, kept so standard ROPC
// clients work unchanged — its value is the user's email.
export interface PasswordGrantParams {
  username?: string;
  password?: string;
  scope?: string;
}
