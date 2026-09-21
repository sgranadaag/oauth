# auth-server

An RFC 6749 authorization server **implemented from scratch** on
[NestJS](https://nestjs.com/): no `oidc-provider`, no auth library. It
also stores the users, so in this repo it is the identity provider too —
see the root [CLAUDE.md](../CLAUDE.md) for how the roles are split with
`auth-provider`.

Today it serves four grants at `POST /oauth/token`:
`client_credentials`, `password`, `otp` and `refresh_token`. `README.md`
has the flows, endpoints and setup.

## Working in this project

- [.claude/rules/architecture.md](.claude/rules/architecture.md) — module
  structure and layering. **Read it before adding or moving any file.**
  The flat-per-module shape (no `domain/application/infrastructure`
  split, no ports/tokens for use cases or repositories) is a settled
  decision reached after two explicit reversals, not a starting point to
  redesign again.
- [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md)
  — naming, comments, testing mechanics and the gotchas already
  discovered the hard way.

## The shape of the module graph

```
oauth/        speaks RFC 6749: the token endpoint, the dispatch by
              grant_type, the scope policy, the error body, one file per
              grant under grantTypes/services/
token/        mints, stores and rotates tokens — knows no protocol
client/  user/  otp/    the domain: registered clients, people, one-time codes
global/redis/  infrastructure that takes config and offers a capability
```

The direction is one-way: `oauth` depends on the domain modules, never
the reverse. Two boundaries carry most of the design:

- **`token` never learns the protocol.** It takes `clientId`, `userId`,
  `scope` and returns `IssuedTokens` in its own vocabulary;
  `OauthService` is the single place the RFC 6749 §5.1 body is spoken.
- **`oauth` never signs anything.** A grant authenticates whoever it is
  about, narrows a scope ceiling, and hands both to `TokenService`.

## Verifying a change

**This project is deliberately light: no tests, no linter, no formatter,
no Docker.** What is left is the server itself. Don't add any of them back
unless the user asks.

The user runs the app themselves, on their own schedule. Do not run
`npm run build` or `npm run start:dev` unless asked; report what changed
and what is therefore worth verifying.

## Storage

MongoDB through TypeORM, with Redis for one-time codes. **There are no
migrations**: collections are schemaless, `synchronize: true` only
creates the declared indexes, and a constraint is an `@Index`. Entities
carry Mongo's `_id` plus their own plain-string `id` — the architecture
rule explains why both.
