# client-front

The application a person signs in to. **It never asks for a password**:
signing in sends the browser to the provider, and the browser comes back
with a one-time code this app exchanges for tokens — the same experience
as "Sign in with Google".

> **This project exists to illustrate the OAuth flow, not to be copied into
> production.** It is a plain Next.js app with the smallest structure that
> still shows where each responsibility lives: no state manager, no tests,
> no linter, no design system. For a production-shaped frontend — layered
> architecture, state management, testing, tooling and the rules that hold
> them together — look at the author's `next-core` template instead.

**In OAuth terms this app is the Client**, and a *confidential* one: it has
a `client_secret` and a server side to keep it on.

## Running it

The three provider projects have to be up first, and the client has to be
registered on the auth server with this app's callback as a redirect URI
(see the root [README](../README.md)):

```bash
cp .env.example .env    # fill OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET
npm i
npm run dev             # http://localhost:3001
```

| Variable | What it is |
| --- | --- |
| `AUTH_SERVER_URL` | Where this app's server calls the auth server (the token exchange) |
| `AUTH_SERVER_PUBLIC_URL` | Where the browser is sent to sign in, only when it differs from `AUTH_SERVER_URL` — the root `docker-compose.yml` sets it, since there the server calls `auth-server:3000` and the browser uses `localhost:3000` |
| `OAUTH_ISSUER` | The `iss` the ID token must carry |
| `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` | This app's credentials. **No `NEXT_PUBLIC_` prefix**: never bundled |
| `OAUTH_REDIRECT_URI` | `/api/auth/callback` — must be registered on the client, exactly |
| `OAUTH_SCOPE` | `openid read write` — `openid` is what earns an ID token |

## The three routes

| Route | Step |
| --- | --- |
| `GET /api/auth/login` | Generates `state`, `nonce` and a PKCE `code_verifier`, keeps them in an httpOnly cookie, redirects to `/oauth/authorize` with only the verifier's hash |
| `GET /api/auth/callback` | Checks `state`, exchanges the code with the secret and the verifier, verifies the ID token's RS256 signature against `GET /oauth/jwks`, then its issuer, audience, expiry and `nonce`, stores the session |
| `POST /api/auth/logout` | Clears this app's session |

Nothing secret goes through the browser: the client secret and the
`code_verifier` only travel on the server-to-server call to
`/oauth/token`. The refresh token stops there too; the page gets the
access token, its scope and lifetime, and the email from the ID token.

## Structure

```
src/
  app/
    page.tsx                    Server Component: reads the session cookie, shows sign-in or the session
    api/auth/login/route.ts     step 1 — state, nonce, PKCE, redirect to the provider
    api/auth/callback/route.ts  step 2 — check state, exchange the code, check the ID token, store the session
    api/auth/logout/route.ts    drop the session
  components/                   signIn, session — presentational
  types/auth.types.ts           the shapes the routes, the page and the components share
```

**No layers, on purpose.** Each route does its whole step top to bottom,
with a short comment on each part, so one file is one step of the flow.
The secret is read only inside the route handlers, which Next never ships
to the browser.
