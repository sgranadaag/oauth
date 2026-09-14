# postman/

`oauth.postman_collection.json` exercises every endpoint and grant
documented in the root [`README.md`](../README.md) — client/user
provisioning, all three grants, JWKS, and the documented error cases
(bad admin key, bad client secret, wrong password, scope exceeding
`allowedScopes`, refresh-token reuse/rotation).

## Import

Postman → Import → select `oauth.postman_collection.json`. No separate
environment file is needed — everything is a collection variable, set
under the collection's Variables tab:

| Variable | Default | Notes |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | Change if the app runs elsewhere |
| `adminApiKey` | `changeme-admin-key` | Must match this repo's `ADMIN_API_KEY` env var |

Everything else (`clientId`, `clientSecret`, `username`, `password`,
`accessToken`, `refreshToken`, `consumedRefreshToken`) is written by the
requests themselves as you run them — no manual setup required beyond
the two above.

## Running it

The app must be running (`npm run start:dev`) and migrated
(`npm run migration:run`) first.

Run folders **top to bottom**, either by hand or via Collection Runner
(right-click the collection → Run collection): later requests reuse
what earlier ones captured — e.g. every grant request needs
`clientId`/`clientSecret` from **1. Client Management**'s "Create
Client", and the Password/Refresh folders need `username`/`password`
from **2. User Management**'s "Create User". Re-running the whole
collection from the top is always safe — "Create Client" and "Create
User" generate fresh values each time (a timestamped username, in
particular) rather than colliding with a previous run.

Verified with `newman run postman/oauth.postman_collection.json
--env-var baseUrl=http://localhost:3000 --env-var
adminApiKey=<your ADMIN_API_KEY>` — 16 requests, 32 assertions, all
passing end-to-end against a live server.
