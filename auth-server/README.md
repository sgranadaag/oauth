# auth-server

An RFC 6749 authorization server implemented from scratch on NestJS — no
auth library. It also stores the users, so in this repo it is the identity
provider as well: see the root [README](../README.md) for how the roles
split with `auth-provider`.

## Endpoints

| Endpoint | Auth | What it does |
| --- | --- | --- |
| `POST /oauth/token` | Basic `client_id:client_secret` | Every grant, dispatched on `grant_type` |
| `POST /clients` | `x-admin-key` | Registers a client and returns its secret once |
| `POST /users/signup` | Basic | Creates a user under the authenticated client |
| `DELETE /users/:userId` | Basic | Deletes one of that client's users |
| `POST /users/change-password` | Bearer | Changes the password of the token's subject |
| `GET /docs` | — | Swagger UI |

## The grants

| `grant_type` | Sends | Gets back |
| --- | --- | --- |
| `client_credentials` | nothing else | Access token with `sub` = `client_id`, no refresh token |
| `password` | `username` (the email) + `password` | Access + refresh token |
| `otp` | `email` + `otp` | Access + refresh token; the code is single-use |
| `refresh_token` | `refresh_token` | A new pair; the presented token is consumed |

Three properties are worth knowing before reading the code:

- **Scopes never widen.** A request narrows a ceiling — the client's
  `allowedScopes`, or what the refresh token was issued for — and
  `ScopeService` is the only place that decides it.
- **Refresh tokens rotate, and reuse revokes the session.** Consuming is
  atomic (`consumedAt: null` in the filter), so presenting a token twice
  deletes every token sharing its `sessionId`.
- **Access tokens are verified offline.** They are RS256 JWTs checked
  against the public key, so nothing can withdraw one before its `exp`.

Nothing issues OTP codes yet: write one into Redis by hand to try that
grant (`SET otp:<userId> 123456 EX 300`).

## Running it

Needs MongoDB on `27017` and Redis on `6379`. There is no Docker setup
here on purpose.

```bash
cp .env.example .env          # first time
npm i
npm run generate-signing-keys # first time: writes src/secrets/*.pem
npm run start:dev             # http://localhost:3000
```

Then register a client with the `ADMIN_API_KEY` from `.env`, and sign a
user up under it — the ordered walkthrough is in the root
[README](../README.md).

## Layout

```
src/modules/oauth/     the protocol: token endpoint, dispatch, scopes, errors, grants
src/modules/token/     minting, storing and rotating tokens — knows no protocol
src/modules/client/    registered clients
src/modules/user/      people, with their bcrypt-hashed passwords
src/modules/otp/       one-time codes, in Redis
src/global/redis/      the Redis connection, as a configurable module
src/guards/            Basic (client), Bearer (access token), admin key
src/utils/             keys, JWT signing and verification, password hashing
```

There are no migrations: MongoDB collections are schemaless, and the
indexes come from the entities.

## Conventions

[.claude/rules/architecture.md](.claude/rules/architecture.md) and
[.claude/rules/coding-standards.md](.claude/rules/coding-standards.md)
hold the module structure, the naming and the decisions that are easy to
undo by accident. **This project has no tests, no linter and no
formatter** — it is meant to be read and run.
