# auth-front

The provider's sign-in page — the equivalent of Google's account chooser
and password screen. **It is the only place a person types their
password.** The client that sent them here never sees it, and neither does
the auth server: this app's server side checks it against the auth server's
`/users/verify` and only then tells its oauth side who signed in.

> Like `client`, this project illustrates the flow and is kept as small as
> possible. For a production-shaped frontend, see the author's `next-core`
> template.

## How a person gets here

Never directly. An application sends the browser to the auth server's
`/oauth/authorize`, which validates the request and redirects here:

```
http://localhost:3003/login?interaction=<id>
```

The URL carries **only that id**. Which client is asking, for which
scopes, and where the code will be sent are all looked up server side, so
none of it can be changed by editing the address bar.

## What happens on submit

```
browser ──POST /api/interactions/:id/login { email, password }──► auth-front (server side)
                                                                      │
     auth-server  POST /users/verify (x-admin-key)  ◄────────────────┤  1. is it right?
                  { id, email }  ─────────────────────────────────► │
                                                                      │
     auth-server  POST /oauth/interactions/:id/accept  ◄─────────────┤  2. this is who signed in
                  { subject, email } (x-admin-key)                    │
                  { redirectTo: client?code&state }  ──────────────► │
                                                                      ▼
browser ◄──────────────────────── { redirectTo } ─────────────────────┘
```

Both calls go to `auth-server`, but to its two different sides: `/users`
is the identity side and `/oauth` the protocol side, and they never call
each other. This app is what joins them.

On success the browser is sent back to the client, carrying a one-time
code. A wrong password leaves the sign-in open to retry; an expired link
asks the person to start again from the application.

The `accept` call is what makes this app trusted: it names who signed in,
with no password, and the auth server believes it on the strength of
`AUTH_SERVER_ADMIN_KEY`. It is only ever made from the server side, with the
user `/users/verify` has just returned.

## Running it

```bash
cp .env.example .env
npm i
npm run dev             # http://localhost:3003
```

| Variable | What it is |
| --- | --- |
| `AUTH_SERVER_URL` | Where the auth server listens |
| `AUTH_SERVER_ADMIN_KEY` | The key this app presents on `/users/verify` and the interaction endpoints — same value as `ADMIN_API_KEY` in `auth-server/.env` |

Neither has a `NEXT_PUBLIC_` prefix: the key stays on the server.

## Structure

```
src/
  app/
    login/page.tsx                        reads ?interaction, asks the auth server who is asking
    api/interactions/[id]/login/route.ts  verify credentials, then accept on the oauth side
  components/   loginForm (client component: posts to the route above), notice
  types/        interaction.types — the shapes the page, the route and the form share
```

**No layers, on purpose.** The page, the route and the form each do their
whole part top to bottom, with a short comment on each step. Both API keys
are read only in the route handler and the page's Server Component, which
Next never ships to the browser.

The accent color differs from `client` on purpose: a person should be able
to see they have left the application and are on the provider's page.
