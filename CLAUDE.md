# oauth

An RFC 6749 OAuth 2.0 authorization server, built from scratch on
[NestJS](https://nestjs.com/) and
[`oidc-provider`](https://github.com/panva/node-oidc-provider). It's one
of the freely-replicable reference implementations on the user's GitHub
profile (see the sibling `sgranadaag` repo) — meant to be read end to
end, not just run. See `README.md` for the actual auth flows
(Client Credentials, Resource Owner Password Credentials, Refresh
Token), endpoints, and setup.

## Working in this repo

- `.claude/rules/architecture.md` — module structure and layering
  conventions. **Read this before adding or moving any file** — the
  current flat-per-module shape (no `domain/application/infrastructure`
  split, no ports/tokens for use cases or repositories) is a settled
  decision reached after two explicit reversals, not a starting point
  to redesign again.
- `.claude/rules/coding-standards.md` — naming, testing mechanics, and
  `oidc-provider`-specific gotchas already discovered the hard way.
  Check here before re-deriving something from library source or specs
  from scratch.
- `.claude/rules/spec-workflow.md` — the spec-driven development
  contract for this repo, loaded automatically every session.

## Spec-driven development

Feature specs live in `specs/<NNN>-<slug>/`, committed to git alongside
the code they describe. Use the `/spec-new`, `/spec-design`,
`/spec-tasks`, `/spec-implement`, `/spec-commit`, `/spec-release`, and
`/spec-verify` skills to move a feature through the workflow phases —
see `specs/README.md` and `.claude/rules/spec-workflow.md` for the full
contract.

`/spec-implement` never commits on its own — it leaves every change
unstaged so the diff can be reviewed first. `/spec-commit` is the
separate, explicit step that stages and commits already-implemented,
already-checked-off tasks once the user is ready. `/spec-release` is a
further separate step, only ever run on explicit request, that promotes
a committed feature branch through dev → qa → master and pushes all
four branches — the highest-blast-radius action in this workflow.

`specs/001-oauth2-authorization-server/` is this repo's own copy of the
spec that produced everything under `src/` — its `design.md` is the
authoritative record of *why* the code looks the way it does, including
every architectural reversal along the way. Read it before assuming a
pattern elsewhere (e.g. a hexagonal ports/adapters split, in a different
project) belongs here too.
