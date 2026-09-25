# auth-server

The **authorization server** (NestJS + MongoDB, port `3000`), implementing
[RFC 6749](https://www.rfc-editor.org/rfc/rfc6749). It also manages and
authenticates the users, only to keep the example complete. See the root
[README](../README.md) for the whole flow.

## Structure

```
src/
  common/       shared, stateless pieces: decorators, guards, utils
  core/         wiring that runs once: config, database, middlewares
  modules/
    client/     registered clients
    user/       user accounts, each one scoped to a client
    oauth/      the protocol: authorization, sessions, tokens, grants
    manager/    development only: clears the OAuth records
secrets/        the signing key pair (never committed)
```

## What it does

| Endpoint | What it does |
| --- | --- |
| `GET /oauth/authorize` | Starts the authorization code flow |
| `GET /oauth/interactions/:id` | Describes a pending sign-in to the login app |
| `POST /oauth/login` | Checks a user's credentials and opens a session |
| `POST /oauth/interactions/:id/accept` | Accepts a pending sign-in and issues the code |
| `POST /oauth/token` | Issues tokens for every grant type |
| `POST /oauth/revoke` | Revokes a refresh token and ends the session ([RFC 7009](https://www.rfc-editor.org/rfc/rfc7009)) |
| `GET /oauth/jwks` | The public signing key ([RFC 7517](https://www.rfc-editor.org/rfc/rfc7517)) |
| `POST /clients` | Registers a client (`x-admin-key`) |
| `POST /users/signup` | Creates a user account |
| `DELETE /manager/oauth-records` | Clears requests, codes, sessions and tokens (`x-admin-key`) |
| `GET /docs` | Swagger UI |

## Run it

```bash
cp .env.example .env
npm install
npm run generate-signing-keys   # first time only
npm run migration:run           # seeds the example clients and users
npm run start:dev
```

It needs a MongoDB at `MONGO_URI`; `docker compose up -d mongo` from the
repository root starts one.
