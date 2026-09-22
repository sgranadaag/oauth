# auth-front

The provider's **login app**: a plain Next.js app with one form, reached
only through a redirect from `auth-server`'s `/oauth/authorize`. See the
root [CLAUDE.md](../CLAUDE.md) for how the three projects fit together.

**It is not an OAuth client** — it holds no `client_id` and no tokens —
**but its server side is a trusted part of the provider.** It checks the
person against the auth server's `/users/verify` and then tells its oauth
side who signed in, and the auth server believes it. That is the login/consent app
model of Ory Hydra or node-oidc-provider's interactions: the auth server
speaks OAuth, and how a person proves who they are (a password today, MFA
later) lives here and on the identity side (`/users`).

## What this project is for

It illustrates the flow; it is not a production frontend. No state
manager, no tests, no linter, no design system. Don't add them unless the
user asks; for a production-shaped frontend, the answer is the `next-core`
template.

## Rules

1. **The URL carries only the `interaction` id.** Never read the client,
   the scope or a redirect target from query parameters — look them up
   from the auth server by id. That is what keeps a tampered URL harmless.
2. **The page never judges a password.** The browser posts the credentials
   to this app's own route; its server side asks `POST /users/verify`, and only on a yes calls the auth server's
   `POST /oauth/interactions/:id/accept`.
3. **`accept` is the most powerful call in the system**: it names who
   signed in, with no password, and is believed. So it is made only from
   the server side, only with `AUTH_SERVER_ADMIN_KEY`, and only with the
   user `/users/verify` just returned — **never with a subject or
   email that came from the browser**.
4. **The API key stays on the server.** It is read only in the route
   handler and the login page's Server Component, neither of which reaches
   the browser bundle. Never read it from a `"use client"` component, and
   never give it a `NEXT_PUBLIC_` name.
5. **Three outcomes, and nothing finer.** Wrong credentials (retry), a dead
   link (start over from the application), anything else (the provider is
   unavailable). Only a 401 from `/users/verify` means wrong credentials
   and only a 404 from the interaction endpoints means a dead link; a wrong key or an
   outage is "unavailable". Don't surface a server's own messages.
6. **The redirect back is a full navigation** (`window.location.assign`):
   the destination is another application.

## Architecture

```
src/
  app/
    login/page.tsx                                  Server Component: GET /oauth/interactions/:id (x-admin-key), then the form
    api/interactions/[interactionId]/login/route.ts POST /users/verify, then POST /oauth/interactions/:id/accept
    page.tsx                                        a notice: nobody lands here on purpose
  components/   loginForm ("use client": posts to this app's own route), notice
  types/        interaction.types — the shapes the page, the route and the form share
```

**Pure implementation, on purpose: no layers.** No services, config,
request core or utils — the page, the route handler and the form each do
their whole part top to bottom, imperatively, with a short comment on each
step. Don't extract helpers or layers back out unless the user asks.

Path segments built from an id (`interactionId`) always go through
`encodeURIComponent`: the id arrives from the browser, and must not be able
to add a path segment to a server-to-server call.

Aliases: `@components/*`, `@shared/*`.

`npm run dev` runs on port 3003. The user runs it; don't run builds unless
asked.
