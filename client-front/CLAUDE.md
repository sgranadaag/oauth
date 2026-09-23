# client-front

The application a person signs in to: a plain Next.js app that runs the
authorization code flow with PKCE against `auth-server` and reads the
OpenID Connect ID token. See the root [CLAUDE.md](../CLAUDE.md) for how the
three projects fit together, and the root README for the flow step by step.

**In OAuth terms this app is the Client**, and a confidential one: it holds
a `client_id` and `client_secret`. **It never sees a password** — the
person types it on `auth-front`, and this app only ever receives a code.

## What this project is for

**It illustrates the flow; it is not a production frontend.** No state
manager, no tests, no linter, no design system — every one of those was
left out on purpose so the OAuth boundary is the only thing on screen.
Don't add them back unless the user asks; if they want a production-shaped
frontend, the answer is the `next-core` template, not growing this one.

## Rules the flow depends on

1. **All the flow lives in the four route handlers**, and only there
   is the environment read. Route handlers never reach the browser bundle,
   which is what keeps `OAUTH_CLIENT_SECRET` on the server. Never read a
   secret from a component, and never give one a `NEXT_PUBLIC_` name.
2. **Nothing secret goes through the browser.** The client secret, the
   PKCE `code_verifier` and the refresh token travel only on the
   back-channel calls to `POST /oauth/token`. The browser carries the
   challenge, `state`, `nonce` and the code — each useless on its own.
   The session cookie holds both tokens and is `httpOnly`; the page
   *renders* them, which is illustration and not a pattern to copy.
3. **`state` and `nonce` are checked, always.** A callback whose `state`
   does not match the transaction cookie exchanges nothing; an ID token
   whose `nonce`, `iss`, `aud` or `exp` is off is rejected.
4. **The ID token's signature is verified before any claim is read**,
   against the auth server's public keys (`GET /oauth/jwks`), by the
   `kid` in its header. **Only `RS256` is accepted** — never let the
   token's own `alg` decide (`none` and `HS256` are how tokens get forged).
   OpenID Connect Core §3.1.3.7 would allow skipping this over real TLS for
   a token straight from the token endpoint; this flow runs over plain
   http, so it doesn't.
5. **Never build a redirect from `request.nextUrl.origin`.** In a
   container Next derives it from the address the server binds to, so it
   comes out as `http://0.0.0.0:3001` — a URL no browser can follow. This
   app's own address is `OAUTH_REDIRECT_URI`'s origin, which is
   configured, absolute and already has to be exact.
6. **Both cookies are httpOnly, `sameSite: lax`.** `lax` is what lets the
   transaction cookie ride along on the top-level GET back from the
   provider.
7. **A refresh stores the rotated token.** The provider hands back a new
   refresh token every time; keep it, or the next renewal presents a spent
   one and the provider ends the session. A refused refresh means the
   session is over — delete the cookie. An unreachable provider does not:
   the session may still be good. The session cookie also outlives the
   access token on purpose, or there would be nothing left to renew with.

## Architecture

```
src/
  app/
    api/auth/login/route.ts     generate state, nonce, PKCE; redirect to /oauth/authorize
    api/auth/callback/route.ts  check state, exchange the code, verify the ID token (JWKS) and its claims, store the session
    api/auth/refresh/route.ts   renew the pair with the refresh token (rotation), re-store the session
    api/auth/logout/route.ts    revoke at the provider, then drop the session cookie
    page.tsx                    Server Component: reads the session cookie
  components/   presentational; no data fetching
  types/        auth.types — the shapes the routes, the page and the components share
```

**Pure implementation, on purpose: no layers.** No services, config,
request core, adapters or utils — each route handler does its whole step
top to bottom, imperatively, with a short comment on each part. Don't
extract helpers or layers back out unless the user asks; a reader should
follow one route file and see the whole step.

`AUTH_SERVER_URL` is where this app's server calls the auth server (the
token exchange); `AUTH_SERVER_PUBLIC_URL` is where the browser is sent
(`/oauth/authorize`). They are the same outside Docker, so the second one
defaults to the first; the root `docker-compose.yml` sets both.

Files are `camelCase` with a suffix (`.component.tsx`, `.types.ts`).
Aliases: `@components/*`, `@shared/*`. Comments are short and say what each
step does or why. Content and code are in English.

`npm run dev` runs on port 3001. The user runs it; don't run builds unless
asked.
