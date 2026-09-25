# auth-front

The provider's **login app** (Next.js, port `3003`): the only place a person
types their password. It is a **pure frontend** and **not an OAuth client** —
it holds no credential of its own and sends the password straight to
`auth-server`. See the root [README](../README.md) for the whole flow.

## Structure

```
src/
  app/          pages, including /login
  components/   UI components (login form, notices)
  services/     calls to the auth server
  constants/    fixed values
  types/        TypeScript types
  styles/       global styles
```

## What it does

`auth-server` sends the browser to `/login?interaction=<id>`. From there:

| Step | Call |
| --- | --- |
| **Show the request** | `GET /oauth/interactions/:id` — which client is asking, and for which scopes |
| **Authenticate** | `POST /oauth/login` — checks the email and password and opens the session |
| **Accept** | `POST /oauth/interactions/:id/accept` — returns where to send the browser, with the code |

## Run it

```bash
cp .env.example .env
npm install
npm run dev
```
