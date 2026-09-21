# oauth

What happens when you click "Sign in with Google", built from scratch and
split into the two pieces that actually exist behind that button:

```
auth-provider  the login screen a person sees          Next.js  :3001
auth-server    issues the tokens, stores the users     NestJS   :3000
```

No auth library on either side. The point is to read the flow end to end.

## The roles

RFC 6749 names four roles. This repo collapses two of them on purpose:

| Role | Here | Why |
| --- | --- | --- |
| Authorization Server | `auth-server` | `POST /oauth/token` |
| Resource Server | `auth-server` | the routes behind its bearer guard |
| Resource Owner | a user in `auth-server` | in real deployments the identity provider is often a separate system; here it is the same process, so the passwords live here |
| Client | `auth-provider` | it holds a `client_id` and a `client_secret` |

The one that surprises people: **`auth-provider` is a Client**, not a
provider. It looks like one to a person, but in the protocol it is the
application asking for tokens. It is a *confidential* client — it has a
secret, and a server side to keep it on.

[docs/diagrams/](docs/diagrams/) has one interactive diagram per grant,
plus a proposal for `authorization_code`. They are standalone HTML files:
open them directly.

## Running it

**1. Start the stores and the server**

MongoDB on `27017` and Redis on `6379`, however you prefer to run them —
there is no Docker setup in this repo on purpose. Then:

```bash
cd auth-server
cp .env.example .env          # first time; point MONGO_URI / REDIS_* at your instances
npm i
npm run generate-signing-keys # first time: the RS256 key pair
npm run start:dev             # http://localhost:3000
```

**2. Register a client and a user**

The server has no clients until you create one. Use the admin key from
`.env` to register a client, then sign a user up under it:

```bash
curl -X POST http://localhost:3000/clients \
  -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"auth-provider","allowedScopes":["read","write"]}'

curl -X POST http://localhost:3000/users/signup \
  -u "<client_id>:<client_secret>" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correct-horse-battery-staple"}'
```

Full endpoint documentation: http://localhost:3000/docs

**3. Start the provider**

Put the `client_id` and `client_secret` from step 2 in
`auth-provider/.env`:

```bash
cd auth-provider
cp .env.example .env          # then fill OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET
npm i
npm run dev                   # http://localhost:3001
```

Sign in with the user from step 2. The page shows the scope, the token
lifetime and the access token itself.

## What happens when you submit that form

```
browser ──POST /api/login──► auth-provider (route handler, server side)
                                   │  Authorization: Basic client_id:client_secret
                                   ▼
                             POST /oauth/token   grant_type=password
                                   │
                             { access_token, refresh_token, expires_in, scope }
```

Three properties of that hop are deliberate:

- **The client secret never reaches the browser.** That is the only reason
  the provider has a server side at all: a browser cannot keep a secret.
- **The server's error body is not forwarded.** The token endpoint answers
  `invalid_grant` for an unknown email and a wrong password alike, so the
  form cannot be used to find out which emails exist.
- **The refresh token stops at the route handler.** It outlives the access
  token, so handing it to a browser would turn a leak into a lasting one.

## A caveat worth stating

The form uses the **Resource Owner Password Credentials** grant, which is
discouraged today and removed in OAuth 2.1: the client sees the user's
password, which is exactly what OAuth exists to avoid. It is here because
it is the shortest honest path from a form to a token, and because seeing
the problem is the point.

The fix is `authorization_code` with PKCE — the user authenticates against
the *server*, and the provider only ever receives a code. The last diagram
in `docs/diagrams/` shows what that would change, what is already built
for it, and what is missing.

## Layout

```
auth-server/     NestJS · MongoDB · Redis · its own CLAUDE.md and rules
auth-provider/   Next.js · its own CLAUDE.md, illustrative only
docs/diagrams/   one diagram per grant
```

Each folder is an independent project with its own conventions. No
development methodology is prescribed by this repo.

**Both projects are deliberately light.** No tests, no linter, no Docker,
no git hooks, no migrations — only what it takes to read the OAuth flow
and run it. Whatever you build on top of this will want most of that back.

That goes double for `auth-provider`: it exists to show where the client
secret lives, not how to structure a frontend. For a production-shaped
one — layered architecture, state management, testing and tooling — look
at the author's `next-core` template instead.
