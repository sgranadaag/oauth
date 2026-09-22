# oauth

Three applications that together do what "Sign in with Google" does, built
from scratch so each piece can be read:

| Folder | Role | Stack | Port |
| --- | --- | --- | --- |
| [client-front/](client-front/) | **Client** — the app a person signs in to | Next.js | 3001 |
| [auth-front/](auth-front/) | The provider's **login app** — the sign-in page, and the server side that vouches for who signed in | Next.js | 3003 |
| [auth-server/](auth-server/) | **Authorization Server / OpenID Provider** (`/oauth`) **and Identity Provider** (`/users`) | NestJS + MongoDB | 3000 |

`auth-front` and `auth-server` together are "the provider". **Each folder
is its own project with its own `CLAUDE.md`**; read the one for the folder
you are working in. `auth-server` also keeps its rules in
`auth-server/.claude/rules/`. This file covers only what spans them. The
step-by-step flow is in [README.md](README.md).

## Two roles in one server

`/oauth` and `/users` are different roles that happen to share a process:
one issues tokens, the other owns the accounts. **They never call each
other.** The login app is what joins them — it asks `/users` whether a
password is right, then tells `/oauth` who signed in. Keep it that way:
the split is a deployment decision, not a design one, and splitting them
into two services must stay a move that changes no logic.

## How they talk

```
client-front ──302──► auth-server /oauth/authorize ──302──► auth-front /login
                     ▲                                   │ credentials (its own server side)
                     │                                   ├──► auth-server POST /users/verify
                     │ POST /oauth/interactions/:id/accept ◄┘  { subject, email }
                     │ ──► { redirectTo: client redirect_uri?code&state }
client-front /callback ┘ POST /oauth/token, then GET /oauth/jwks
```

The rules that hold that together — a change anywhere has to keep all of
them:

- **The password is typed in `auth-front` and nowhere else.** Its server
  side sends it to `/users/verify`; neither the client nor the `/oauth`
  side ever sees it, and the hash never leaves the `user` module.
- **`accept` is the most powerful call in the system.** It names who
  signed in, with no password, and is believed. It is made only by
  `auth-front`'s server side, with the provider key, and only with the
  user `/users/verify` just returned.
- **One provider credential.** `ADMIN_API_KEY` in `auth-server` and
  `AUTH_SERVER_ADMIN_KEY` in `auth-front` are the same value: it registers
  clients, reads and accepts interactions, and checks credentials.
  Everything behind it is the provider talking to itself, never a browser.
- **Each secret stays where it is used.** The client secret and the PKCE
  verifier live in `client-front`'s server side and travel only on the
  back-channel token call. Nothing secret goes through the browser.
- **The browser carries only what may leak.** `interaction` ids, codes,
  `state`, `nonce` and the PKCE challenge — each short-lived, single-use or
  useless on its own.
- **Every "no" looks the same.** Unknown email and wrong password are one
  answer at every layer, so no layer can be used to find out which
  accounts exist.
- **An outage is not a wrong password.** An unreachable or misconfigured
  server is a 5xx all the way up, never "wrong email or password" and
  never `invalid_grant`. That is why a bad provider key is a **403**: 401
  on `/users/verify` means wrong credentials, and only that.

## Storage

One MongoDB database, one collection per entity: `clients`, `tokens`,
`authorization_requests` and `authorization_codes` for the `/oauth` side,
`users` for the identity side. **Sharing a database is not permission to
share the data**: the `/oauth` side must never query `users`, and
`UserModule` exports nothing so it cannot by accident.

## Conventions in this repo

- **No development methodology is prescribed.** No spec workflow, no
  phase gate; this repo is about the OAuth flows.
- **All three projects are deliberately light**: no tests, no linter, no
  formatter, no git hooks, no migrations. Don't reintroduce any of them
  unless the user asks.
- **Docker is only for running the whole stack**: `docker-compose.yml` at
  the root (MongoDB + the three projects) and one multi-stage `Dockerfile`
  per project. The compose reads each project's `.env` and overrides only
  what changes inside Docker — container-to-container addresses by service
  name. Anything the browser follows (issuer, redirect URIs, login page,
  `client-front`'s `AUTH_SERVER_PUBLIC_URL`) stays on `localhost`. No
  `.env` and no signing key ever goes into an image (`.dockerignore`); the
  keys are mounted from `auth-server/src/secrets/`.
- **The front ends illustrate the flow, they don't model a frontend.** Keep
  them small and layerless — each route handler does its whole step
  imperatively — and point at the `next-core` template for anything
  production-shaped.
- Code, comments and user-facing copy are in English. Conversation with
  the user is in Spanish.
- **Readability over density**, in all three projects: a method that
  awaits is `async` and returns plain values (never `Promise.resolve(x)`
  to stay synchronous); an awaited call is assigned to a named `const`
  rather than inlined into the `return`
  (`const providerUrl = await …; return { url: providerUrl };`); and a
  conditional spread is named above the literal rather than written
  inline (`const idTokenField = idToken ? { id_token: idToken } : {};`).
  `auth-server/.claude/rules/coding-standards.md` has the examples.
- Secrets are never committed. Each project keeps its own `.env`
  (gitignored) and `.env.example` in sync; `ADMIN_API_KEY` (auth-server)
  has to match `AUTH_SERVER_ADMIN_KEY` (auth-front).
