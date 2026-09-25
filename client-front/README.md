# client-front

The **client application** (Next.js, port `3001`): the app a person signs in
to. It is a **public client** — a pure frontend that runs only in the
browser, so it holds **no client secret**. See the root [README](../README.md)
for the whole flow.

## Structure

```
src/
  app/          pages: / (home) and /callback
  components/   UI components (sign-in and session cards)
  services/     calls to the auth server
  constants/    fixed values
  types/        TypeScript types
  utils/        helpers (crypto, session storage)
  styles/       global styles
public/
  public.pem    the auth server's public key, to verify access tokens
```

## What it does

| Function | How |
| --- | --- |
| **Sign in** | Sends the browser to `GET /oauth/authorize` with a fresh `state` |
| **Callback** | Checks `state`, exchanges the `code` at `POST /oauth/token`, verifies the access token's signature |
| **Silent sign-in** | On a new visit, calls `/oauth/authorize` with `prompt=none` to reuse the provider's session |
| **Renew** | Gets a new pair of tokens with the refresh token |
| **Sign out** | Calls `POST /oauth/revoke`, which ends the tokens and the session |

Tokens are kept in `sessionStorage`, so they are lost when the browser
closes.

## Run it

```bash
cp .env.example .env
npm install
npm run dev
```
