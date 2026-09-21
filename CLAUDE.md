# oauth

Two applications that together do what "Sign in with Google" does, built
from scratch so each piece can be read:

| Folder | What it is | Stack |
| --- | --- | --- |
| [auth-server/](auth-server/) | The server: issues tokens and stores the users | NestJS + MongoDB + Redis |
| [auth-provider/](auth-provider/) | The login screen a person actually sees | Next.js |

**Each folder is its own project with its own `CLAUDE.md`.** Read the one
for the folder you are working in before changing anything there — they do
not share conventions, and the server additionally keeps its rules in
`auth-server/.claude/rules/`. This file covers only what spans both.

`auth-provider` is there to illustrate the flow, not to model a frontend:
keep it small, and point at the `next-core` template for anything
production-shaped.

## Who plays which role

RFC 6749 names four roles. This repo collapses two of them on purpose:

| Role | Here |
| --- | --- |
| **Authorization Server** | `auth-server` — `POST /oauth/token` |
| **Resource Server** | `auth-server` — the routes behind `BearerTokenGuard` |
| **Resource Owner** | a person, stored as a user in `auth-server`'s `users` collection |
| **Client** | `auth-provider` — it holds a `client_id` and `client_secret` |

In a real deployment the authorization server and the identity provider
are usually separate systems; **here they are the same process**, which is
why the users and their passwords live in `auth-server` rather than
somewhere behind it.

The role assignment worth remembering: **`auth-provider` looks like a
login provider to a person, but in OAuth terms it is a Client.** It is a
confidential one — it has a secret and a server side to keep it on.

The five diagrams in [docs/diagrams/](docs/diagrams/) show the roles per
grant, including a proposal for `authorization_code`. Open the `.html`
files; the `.json` beside each one is its source.

## How the two talk

```
browser ──POST /api/login──► auth-provider (Next route handler)
                                  │  Authorization: Basic client_id:client_secret
                                  ▼
                            POST /oauth/token   grant_type=password
                                  │
                            { access_token, refresh_token, ... }
```

Three properties hold that contract together, and a change on either side
has to preserve all three:

- **The client secret never reaches the browser.** It is read in
  `auth-provider`'s route handler, server side. A browser cannot keep a
  secret, which is the only reason that handler exists.
- **The provider never forwards the server's error body.** The token
  endpoint answers `invalid_grant` for an unknown email and for a wrong
  password alike, and the provider keeps that indistinguishable.
- **The refresh token stops at the route handler.** Only the access token,
  its lifetime and its scope reach the page.

## Running both

`auth-server` on port 3000, `auth-provider` on 3001. The server has to be
up first: the provider is useless without it, and the `client_id` and
`client_secret` in `auth-provider/.env` are issued by the server. See
[README.md](README.md) for the ordered walkthrough.

## Conventions in this repo

- **No development methodology is prescribed.** There is no spec workflow,
  no phase gate and no required ceremony; this repo is about the OAuth
  flows, not about how work gets planned.
- **Both projects are deliberately light**: no tests, no linter, no
  formatter, no Docker, no git hooks, no migrations. Don't reintroduce any
  of them unless the user asks. The conventions in each project's rules
  are read, not enforced by tooling.
- Code, comments and user-facing copy are in English. Conversation with
  the user is in Spanish.
- Secrets are never committed. Each project keeps its own `.env`
  (gitignored) and its own `.env.example` in sync.
