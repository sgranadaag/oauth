---
description: Naming, testing, and library-integration conventions for this repository
---

# Coding standards

See `.claude/rules/architecture.md` first for module structure. This
rule covers naming, testing mechanics, and specific gotchas already
discovered the hard way in this codebase — re-reading library source or
re-discovering these empirically is wasted effort the second time.

## Naming

Every variable, parameter, and field name should say what it holds —
`typeOrmRepository`, `requestedScope`, `modelName`, not `repo`, `s`,
`name`. Idiomatic short names that are unambiguous from context stay
short (`req`/`res`/`ctx`/`dto`/`iv` — a real cryptographic term, not a
lazy abbreviation). When in doubt, prefer the longer, clearer name.

## Comments

Default to none. Only write one when the *why* isn't obvious from the
code itself — a library quirk with no other trace (undocumented
behavior, a workaround for a specific bug), a non-obvious ordering
requirement, or a deliberate trade-off a future reader might otherwise
"fix." Never restate what the code already says.

## Testing

- `npm test` and `npm run test:e2e` **must** run with `--runInBand`
  (already set in `package.json`) — several tests share real Postgres
  tables, and Jest's default parallel workers race each other's
  `afterAll` cleanup against still-running assertions in a sibling
  suite. Don't remove this to "speed things up."
- `npm run test:e2e` invokes `node --experimental-vm-modules
  node_modules/jest/bin/jest.js`, not the `jest` CLI shim — booting the
  real `AppModule` triggers `OidcModule`'s one dynamic
  `import('oidc-provider')`, which Jest's default runtime can't execute
  without that flag. On Windows, `node_modules/.bin/jest` is a POSIX
  shell script and fails outright under `node` — always invoke
  `node_modules/jest/bin/jest.js` directly, never the `.bin` shim.
- `Repository.save()` **upserts** when the entity's primary key is
  already set (it does a SELECT, then insert-or-update) — a test
  asserting a real uniqueness-constraint violation must use
  `Repository.insert()` instead, which issues an unconditional `INSERT`
  and actually hits the Postgres constraint.
- `Repository.clear()` (`TRUNCATE`) fails whenever *any* table has a
  foreign key referencing the target table, regardless of whether any
  row actually references anything — structural, not row-count-based.
  Use a real `DELETE` (`repository.createQueryBuilder().delete().execute()`)
  for cleanup on a table something else references (e.g. `clients`,
  referenced by `users.clientId`).

## `oidc-provider` integration

- The installed version is ESM-only (`"type": "module"`, no CJS
  export). Any dynamic `import('oidc-provider')` should happen **once**,
  inside a Nest async factory provider (see `OidcModule`'s
  `OIDC_ERRORS`/`OIDC_PROVIDER` providers) — everything else receives
  the already-resolved value (`errors`, the constructed `Provider`)
  through normal DI, rather than importing the package itself.
- Client metadata returned from `OidcAdapter.find()` for
  `modelName === 'Client'` must include `redirect_uris: []` and
  `response_types: []` — present but empty, not omitted — or every
  token request fails with `invalid_redirect_uri`, even though this
  server never uses the Authorization Code/Implicit grants those fields
  belong to.
- `'refresh_token'` in a client's `grant_types` only validates if the
  provider's own top-level `scopes` config includes `'offline_access'`
  (`scopes: [...SUPPORTED_SCOPES, 'offline_access']`) — that's a
  provider-wide gate, unrelated to this project's own business scopes.
- A custom grant handler (`PasswordGrantService`) needs
  `grant.addResourceScope(...)` called explicitly on the `Grant`, *and*
  `resource: DEFAULT_RESOURCE` set on the `RefreshToken` constructor
  properties, or JWT-formatted access tokens silently degrade to opaque
  ones on a later native refresh.
- Any parameter a custom grant handler reads from `ctx.oidc.params`
  (e.g. `scope`) must be declared in `registerGrantType`'s params array,
  or `oidc-provider` silently strips it before the handler ever runs.

## Secrets: hashed vs. encrypted (deliberate, not inconsistent)

User passwords are bcrypt-hashed (one-way) in `UserService`. Client
secrets are AES-256-GCM **encrypted, reversibly**
(`src/utils/secretCipher.util.ts`), not hashed — this is intentional,
not an oversight: `oidc-provider`'s built-in client authentication (used
by `POST /oauth/token` and by `ClientAuthGuard`) does a direct plaintext
comparison against the stored secret, with no documented hook for a
hash-comparison alternative. Don't "fix" this inconsistency without
re-reading `specs/*/design.md`'s Alternatives section on client secret
storage first.
