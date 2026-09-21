# auth-provider

The login screen for [`auth-server`](../auth-server): one form, email and
password, plus the server side that holds the client credentials.

> **This project exists to illustrate the OAuth flow, not to be copied into
> production.** It is a plain Next.js app with the smallest structure that
> still shows where each responsibility lives: no state manager, no tests,
> no linter, no design system. For a production-shaped frontend — layered
> architecture, state management, testing, tooling and the rules that hold
> them together — look at the author's `next-core` template instead.

**In OAuth terms this app is a confidential Client**, not a provider. It
looks like one to a person — it is the screen where they type their
password — but in the protocol it is the application requesting tokens on
their behalf. It is *confidential* because it has a secret and a server
side to keep it on.

## Running it

`auth-server` has to be up first, and the client credentials come from it
(see the root [README](../README.md)):

```bash
cp .env.example .env    # fill OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET
npm i
npm run dev             # http://localhost:3001
```

| Variable | What it is |
| --- | --- |
| `AUTH_SERVER_URL` | Where the auth server listens (`http://localhost:3000`) |
| `OAUTH_CLIENT_ID` | The client registered on that server |
| `OAUTH_CLIENT_SECRET` | Its secret. **No `NEXT_PUBLIC_` prefix**: it must never be bundled |

## The one boundary that matters

```
browser ──POST /api/login──► route handler (server side)
                                  │  Authorization: Basic client_id:client_secret
                                  ▼
                            POST /oauth/token   grant_type=password
```

Everything in `src/server/` runs on the server and nowhere else. Those
files start with `import "server-only"`, so importing one from a component
**fails the build** instead of quietly shipping the client secret to the
browser. That is the separation this project is built to show.

The handler also decides what comes back: the access token, its lifetime
and its scope. **The refresh token stops there** — it outlives the access
token, so a browser is the wrong place for it — and the auth server's
error body is never forwarded, so the form cannot be used to find out
which emails exist.

## Structure

```
src/
  app/                      routing only
    layout.tsx              the shell
    page.tsx                a Server Component that composes the form
    api/login/route.ts      the server entry point: the only caller of src/server/
  components/
    loginForm.component.tsx "use client": the inputs, the submit, the result
  api/
    login.api.ts            the browser's only call — to /api/login, same origin
  server/                   server-only, enforced by "server-only"
    authServer.config.ts    where the auth server is, and who this app is to it
    authServer.service.ts   the only place the auth server is called
  adapters/
    login.adapter.ts        credentials -> token request, token response -> session
  types/auth.types.ts       the shapes both sides agree on
  styles/globals.css
```

The dependency direction is one-way: `app/` → `components/` → `api/`, and
`app/api/` → `server/`. Both ends meet at `adapters/` and `types/`, which
import nothing. A component cannot reach `server/`, and `server/` knows
nothing about React.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3001 (3000 is the auth server) |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
