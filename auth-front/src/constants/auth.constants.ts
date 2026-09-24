// This app is a pure frontend and holds no credential: everything here is
// public by construction. The `NEXT_PUBLIC_` prefix is what makes Next inline
// the value at build time — without it it would be `undefined` in the page.
export const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL ?? "http://localhost:3000";
