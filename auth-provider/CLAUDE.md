# auth-provider

The login screen for `auth-server`: a plain Next.js app with one form. See
the root [CLAUDE.md](../CLAUDE.md) for how the two apps fit together and
which OAuth role each plays.

**In OAuth terms this app is a confidential Client**, not a provider — it
holds a `client_id` and `client_secret` and exchanges credentials for
tokens. The name describes what it looks like to a person, not its role in
the protocol.

## What this project is for

**It illustrates the flow; it is not a production frontend.** No state
manager, no tests, no linter, no design system — every one of those was
left out on purpose so the OAuth boundary is the only thing on screen.
Don't add them back unless the user asks; if they want a production-shaped
frontend, the answer is the `next-core` template, not growing this one.

## Architecture

Two rules carry the whole design:

1. **`src/server/` is server-only, and it is the only thing that talks to
   the auth server.** Every file there starts with `import "server-only"`,
   so importing one from a component fails the build rather than shipping
   the client secret to the browser. Its only caller is
   `app/api/login/route.ts`.
2. **The dependency direction is one-way.** `app/` → `components/` →
   `api/`, and `app/api/` → `server/`. Both ends meet at `adapters/` and
   `types/`, which import nothing and are the only shared vocabulary. A
   component never reaches `server/`; `server/` never imports React.

```
src/
  app/          routing and composition only
    api/login/route.ts    the server entry point
  components/   "use client" where state and handlers are needed
  api/          the browser's calls to this app's own routes
  server/       server-only: config and the auth server client
  adapters/     shape transformations, pure, both directions
  types/        the shapes both sides agree on
  styles/       one plain CSS file
```

A new screen follows the same order: types → adapter → the call → the
component → the route.

## Conventions

- Files are `camelCase` with a suffix naming the layer:
  `.component.tsx`, `.adapter.ts`, `.service.ts`, `.config.ts`,
  `.api.ts`, `.types.ts`.
- Path aliases: `@components/*`, `@api/*`, `@server/*`, `@adapters/*`,
  `@shared/*` → `src/types/*`. No `../` imports across folders.
- A `page.tsx` stays a Server Component and composes; only the part that
  needs hooks or handlers is `"use client"`.
- Comments explain a *why* that the code cannot: the server-only boundary,
  a protocol requirement, a deliberate omission. Not what the line does.
- Content and code are in English. Conversation with the user is Spanish.
- Never give a browser-visible variable the client secret, and never add
  `NEXT_PUBLIC_` to it.

## Commands

`npm run dev` (port 3001, since 3000 is the auth server), `npm run build`,
`npm run start`, `npm run typecheck`. The user runs them; don't run builds
unless asked.
