# oauth

What happens when you click "Sign in with Google", built from scratch and
split into the pieces that actually exist behind that button:

```
client-front  the app a person signs in to                     Next.js  :3001
auth-front    the provider's sign-in page (its login app)      Next.js  :3003
auth-server   the provider's OAuth / OpenID endpoints          NestJS   :3000
              plus /users — the accounts and their passwords
```

The last two together are "the provider" — the part Google plays. No auth
library anywhere: the point is to read the flow end to end.

**The authorization server and the identity provider are different
roles**, even though they run in one process here: `/oauth` issues tokens
and `/users` owns the accounts, and **neither calls the other**. The login
app is what joins them: it asks `/users` whether a password is right, and
then tells `/oauth` who signed in. Split them into two services and
nothing about the flow changes.

## The roles

| Role | Here |
| --- | --- |
| **Client** | `client-front` — holds a `client_id` and a `client_secret`, never sees a password |
| **Authorization Server** (OpenID Provider) | `auth-server`'s `/oauth` — `/oauth/authorize`, `/oauth/token`, `/oauth/jwks` |
| **Identity Provider** | `auth-server`'s `/users` — the accounts and their bcrypt hashes |
| **Resource Owner** | a person, whose account lives in `/users` |
| **Resource Server** | none yet — an API accepting these tokens would verify them offline against `GET /oauth/jwks` |

`auth-front` is not a protocol role: it is the provider's own **login
app**, the one place a person types their password.

## The flow, exactly

Authorization code with PKCE, plus OpenID Connect's ID token:

```
 browser        client-front       auth-server /oauth    auth-front     auth-server /users
    │  Sign in        │                  │                  │                  │
    ├────────────────►│                  │                  │                  │
    │  302 /oauth/authorize?client_id&redirect_uri&state&nonce&code_challenge  │
    │◄────────────────┤                  │                  │                  │
    ├───────────────────────────────────►│ validates, stores the request       │
    │  302 auth-front/login?interaction=…                   │                  │
    │◄───────────────────────────────────┤                  │                  │
    ├──────────────────────────────────────────────────────►│ shows who asks   │
    │  email + password (typed here, and only here)         │  /users/verify   │
    ├──────────────────────────────────────────────────────►├─────────────────►│
    │                 │                  │                  │◄─────────────────┤ { id, email }
    │                 │                  │◄─────────────────┤ accept { subject, email }
    │                 │                  │ issues a one-time code              │
    │                 │                  ├─────────────────►│ { redirectTo }   │
    │  redirect to client-front/callback?code&state         │                  │
    │◄──────────────────────────────────────────────────────┤                  │
    ├────────────────►│ checks state     │                  │                  │
    │                 ├─────────────────►│ POST /oauth/token                   │
    │                 │  code + code_verifier + client secret                  │
    │                 │◄─────────────────┤ access + refresh + id_token         │
    │                 ├─────────────────►│ GET /oauth/jwks                     │
    │                 │◄─────────────────┤ { keys } — verifies the signature   │
    │  signed in      │ checks nonce     │                  │                  │
    │◄────────────────┤                  │                  │                  │
```

1. **The client starts it.** It generates `state`, `nonce` and a PKCE
   `code_verifier`, keeps them in an httpOnly cookie, and redirects the
   browser to `/oauth/authorize` with only the verifier's hash.
2. **The authorization side validates the request** — known client, a
   `redirect_uri` registered for it *exactly*, PKCE present, scopes allowed
   — stores it, and sends the browser to the login app with nothing but an
   `interaction` id.
3. **The person signs in on the login app.** It shows which client is
   asking and for what. Its server side checks the credentials against
   `POST /users/verify`, then tells the authorization side who signed in
   (`POST /oauth/interactions/:id/accept`, behind the provider key).
   Neither the client nor the authorization side sees the password.
4. **The authorization side issues a one-time code**, and the browser is
   sent back to the client's `redirect_uri` with `code` and `state`.
5. **The client checks `state`**, then exchanges the code server to server,
   with its secret and the `code_verifier`. The server checks the code is
   unused and unexpired, was issued to this client, for this
   `redirect_uri`, and that the verifier hashes to the stored challenge.
6. **The client verifies the ID token** — first its RS256 signature,
   against the public key from `GET /oauth/jwks` (picked by the `kid` in
   the token header), then the issuer, audience, expiry and the `nonce` it
   generated — and knows who signed in.

From there the session belongs to the authorization side. The identity
side vouched for the person once and is never asked again: a refresh
checks only the authorization side's own record, and every session has a
fixed end (30 days from sign-in, never extended by rotation) that sends
the person back through the login app.

**Renewing** is the second half, and `client-front` shows it: its page
prints when the access token expires, and **Renew token** posts to its own
`/api/auth/refresh`, which trades the refresh token for a new pair at
`POST /oauth/token` — no browser, no person, just the client's secret. The
provider rotates the refresh token on every use, so the value on screen
changes too; presenting a spent one ends the whole session, on the
assumption that a token used twice has been copied.

**Signing out** ends it on both sides: `client-front` calls
`POST /oauth/revoke` (RFC 7009) with the refresh token before dropping its
own cookie, so the session dies at the provider too. The access token
already issued keeps working until it expires — a JWT verified offline
cannot be withdrawn, which is the trade-off for not asking the provider on
every request.

What each check buys:

| Check | Stops |
| --- | --- |
| `redirect_uri` exact match | a code being delivered to an attacker's URL |
| `state` | a forged callback logging you into someone else's session (CSRF) |
| PKCE | a code intercepted on its way back being exchanged by anyone else |
| single-use code | a code being replayed |
| ID token signature (JWKS, RS256 only) | a forged or altered ID token — including one that claims `alg: none` |
| `nonce` | an ID token from another sign-in being replayed |
| secret only in server code | the client's identity leaking through the browser |

## Running it with Docker

[docker-compose.yml](docker-compose.yml) builds and connects the three
projects plus MongoDB. Each project keeps its own `Dockerfile`; the compose
reads each project's `.env` and only overrides the addresses that change
inside Docker (containers call each other by service name, while everything
the browser follows stays on `localhost`).

```bash
for p in auth-server auth-front client-front; do cp $p/.env.example $p/.env; done
docker compose up -d --build
```

The `.env.example` values already agree with each other, so the copies work
as they are for a local run. The first start writes the signing keys to
`auth-server/src/secrets/` (mounted, never baked into an image). MongoDB is
published on **27017**, the port every `.env` expects — change it in the
compose if a local instance already owns that port.

Running only the database is enough to work on the servers themselves:
`docker compose up -d mongo`, then `npm run start:dev` or `npm run dev` in
each project.

Then register a client and a person (step 3 below — same `curl`s), put the
returned `client_id` and secret in `client-front/.env`, and recreate it:

```bash
docker compose up -d --force-recreate client-front
```

Open http://localhost:3001. `docker compose down -v` stops everything and
wipes the database.

Inside Docker the front ends run with `NODE_ENV=production`, so the
client's cookies are `Secure`: Chrome, Edge and Firefox accept that on
`http://localhost`, Safari does not.

## Running it without Docker

**1. MongoDB**, however you like — one database, five collections.

**2. The server:**

```bash
cd auth-server && cp .env.example .env && npm i
npm run generate-signing-keys                    # first time
npm run start:dev                                # :3000
```

`ADMIN_API_KEY` is the provider's own credential: it registers clients and
opens `/users/verify` and the interaction endpoints. `auth-front` presents
the same value as `AUTH_SERVER_ADMIN_KEY`.

**3. A client and a person:**

```bash
curl -X POST http://localhost:3000/clients \
  -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Demo client","allowedScopes":["openid","read","write"],
       "redirectUris":["http://localhost:3001/api/auth/callback",
                       "http://localhost:9999/callback"],
       "grantTypes":["authorization_code","refresh_token"]}'

curl -X POST http://localhost:3000/users/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correct-horse-battery-staple"}'
```

`openid` is what earns an ID token. The second redirect URI is only for the
by-hand walkthrough below. `grantTypes` is what this client may use — the
two above are the default, and a service wanting `client_credentials` has
to ask for it. Add `"accessTokenTtlSeconds": 900` to give this client
shorter access tokens than the server default.

Where people sign in is not a client setting: the server has one login
app, configured as `LOGIN_APP_URL`.

**4. The two front ends:**

```bash
cd auth-front    && cp .env.example .env && npm i && npm run dev   # :3003
cd client-front  && cp .env.example .env                           # fill OAUTH_CLIENT_ID / _SECRET
npm i && npm run dev                                               # :3001
```

Open http://localhost:3001 and click **Sign in with the provider**.

## The same flow by hand, with Postman

Useful to see each hop. Generate a PKCE pair:

```bash
node -e "const c=require('crypto');const v=c.randomBytes(32).toString('base64url');console.log('verifier ',v);console.log('challenge',c.createHash('sha256').update(v).digest('base64url'))"
```

1. Open in a browser:
   `http://localhost:3000/oauth/authorize?response_type=code&client_id=<id>&redirect_uri=http://localhost:9999/callback&scope=openid%20read&state=abc&nonce=xyz&code_challenge=<challenge>&code_challenge_method=S256`
2. Sign in on the provider's page.
3. The browser lands on `localhost:9999/callback?code=…&state=abc`. Nothing
   listens there, so the page fails — **the code is in the address bar**.
   It expires in two minutes.
4. In Postman: `POST http://localhost:3000/oauth/token`, Basic auth with
   the client credentials, `x-www-form-urlencoded` body:
   `grant_type=authorization_code`, `code`, `redirect_uri` (the same one),
   `code_verifier`.

Postman can also run all of it for you (Authorization tab → OAuth 2.0 →
*Authorization Code (With PKCE)*) if its callback URL is registered on the
client.

## Layout

```
docker-compose.yml   the whole stack: MongoDB + the three projects
client-front/        Next.js · the OAuth client · illustrative only
auth-front/          Next.js · the provider's login app
auth-server/         NestJS · MongoDB · /oauth and /users · its own CLAUDE.md and rules
```

**All three are deliberately light.** No tests, no linter, no git hooks, no
migrations — only what it takes to read the flow and run it. Docker is
there only to run the stack. The two front ends in particular show where
secrets live, not how to structure a frontend: for a production-shaped one,
see the author's `next-core` template.
