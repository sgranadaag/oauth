---
description: Module structure and layering conventions for this repository
---

# Architecture

This structure was arrived at after two explicit reversals during the
original build (a "brief" flat ports/adapters split, then a full
`nest-hexagonal`-style `domain/application/infrastructure` layering with
ID value objects and port/token pairs for every use case and
repository — both tried, both superseded; see `specs/*/design.md`'s
Alternatives sections for the full reasoning). **Treat what's below as a
settled decision, not a default to rediscover** — don't reintroduce
either of those patterns without the user explicitly asking for it.

## Module shape

Every feature module lives flat under `src/modules/<name>/` — singular
folder name, **no** `domain/`, `application/`, or `infrastructure/`
subfolders:

```
src/modules/client/
  client.entity.ts        # TypeORM entity — also the only "domain" model
  client.repository.ts    # concrete class wrapping Repository<ClientEntity>
  client.service.ts       # one class per module, one method per action
  client.controller.ts
  client.module.ts
  dto/
    createClient.dto.ts
    clientResponse.dto.ts
```

- **One entity class per aggregate, and it *is* the TypeORM row.** No
  separate domain/Postgres entity pair, no mapper. `id` (and any
  foreign-key field, e.g. `User.clientId`) is a plain `string` — no
  dedicated ID value object, and the Postgres column itself is
  `varchar`, not `uuid` (constraining the DB column type would
  contradict "plain string id" just as much as a TypeScript wrapper
  class would). Production code still populates `id` with
  `randomUUID()` at creation time — only the *format constraint* was
  dropped, not the practice.
- **One `<Name>Repository` class per module, injected by concrete
  class — no port/interface, no `Symbol` token.** A module that needs
  another module's repository (e.g. `UserService` needing
  `ClientRepository`) gets it because the owning module exports the
  class itself from its `@Module()` `exports` array; Nest resolves a
  class as its own DI token, so nothing else is needed.
- **One `<Name>Service` class per module, not one class per use case.**
  Every action the module supports is a named method on that one class
  (`ClientService.create(...)`, and any future ones on the same class)
  — not a fresh `execute()`-only class (and inbound port) per action.
  Controllers inject the concrete service class directly.
- **DTOs are the one thing still pulled into their own subfolder**
  (`dto/`) — kept apart from the entity/repository/service/controller
  files sitting next to them, even though everything else is flat.
- **A guard that depends on a module's repository lives inside that
  module**, not in `src/common/guards/` — e.g. `ClientAuthGuard` lives
  in `src/modules/client/` because it needs `ClientRepository`. A guard
  with no such dependency (e.g. `AdminGuard`, which only reads
  `ConfigService`) belongs in `src/common/guards/` instead.
- File naming is `camelCase.role.ts` throughout.

## What this does *not* apply to

- **An external library's own contract is not a "port" to eliminate.**
  `oidc-provider`'s `Adapter` interface (implemented by `OidcAdapter`)
  is defined by the library, not by this codebase — it stays as-is
  regardless of how far the internal port-elimination direction goes.
- **DI tokens for bridging a third-party value are not the same problem
  as an internal port/token.** `OIDC_ERRORS` and `OIDC_PROVIDER` are
  `Symbol` tokens carrying values that only exist because
  `oidc-provider` itself must be constructed/imported once (it's
  ESM-only — see the coding-standards rule) — they aren't standing in
  for an interface with a swappable implementation, so they're
  unaffected by "no ports/tokens for repositories or use cases."

## Cross-cutting code

Code with no per-module home (`AdminGuard`, generic utils like
`secretCipher.util.ts`) lives under `src/common/`, `src/utils/`,
`src/config/`, `src/constants/` — one flat purpose-named folder each,
matching the `@common/*`, `@utils/*`, `@config/*`, `@constants/*` path
aliases in `tsconfig.json`. Use those aliases (and `@modules/*`,
`@tests/*`) for all imports — no relative `../../..` climbing across a
module boundary.

## Tests

Tests live under `src/tests/<module>/<name>.<role>.test.ts`, one test
file per source file, same base name. Entity/repository/adapter tests
are real integration tests against a local Postgres (via
`TypeOrmModule.forRootAsync`) — not mocked — while service tests mock
the repository classes they depend on. Controllers and guards are
covered by e2e tests only (`test/**/*.e2e-spec.ts`), never a unit test
of their own. See the coding-standards rule for the specific gotchas
this convention has already run into.
