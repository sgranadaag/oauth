# middlewares/

Cross-cutting Express/Nest middleware — request-level logic that runs
before routing, as distinct from `src/guards/` (route-level allow/deny
decisions). See `.claude/rules/architecture.md`.

- `requestLogger.middleware.ts` — one line per request, emitted on
  `response.finish` so it carries the status and duration:
  `POST /oauth/token 200 412.3ms client=3f2a9e10-…`. Applied to every
  route from `AppModule.configure()`.

## What must never be logged here

This is an authorization server; its request bodies are credentials.

- **Never log a request body.** `/oauth/token` carries `password` and
  `client_secret` in cleartext, `/users/signup` carries `password`.
- **Never log the `Authorization` header.** `describeCaller` reads only
  the *username* half of Basic auth (the `client_id`) and stops at the
  first colon; the secret after it is never read. A bearer token is
  never logged either — only the `sub` and `client_id` claims a guard
  already decoded from it.
- **Query strings are redacted** against `SENSITIVE_QUERY_PARAMS` before
  they reach a log line. Nothing here puts credentials in a URL today;
  the redaction exists because a log is permanent and a future endpoint
  might.
