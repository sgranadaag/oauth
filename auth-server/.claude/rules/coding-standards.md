---
description: Naming, testing, and library-integration conventions for this repository
---

# Coding standards

See `.claude/rules/architecture.md` first for module structure. This
rule covers naming, testing mechanics, and specific gotchas already
discovered the hard way in this codebase — re-reading library source or
re-discovering these empirically is wasted effort the second time.

## Naming

Every variable, parameter, and field name should say what it holds —
`typeOrmRepository`, `requestedScope`, `modelName`, not `repo`, `s`,
`name`. Idiomatic short names that are unambiguous from context stay
short (`req`/`res`/`ctx`/`dto`/`iv` — a real cryptographic term, not a
lazy abbreviation). When in doubt, prefer the longer, clearer name.

## Readability over density

Four rules, all about reading a line once and knowing what it does.

**A method that awaits is `async`, and returns plain values.** Don't reach
for `Promise.resolve(...)` to keep a method synchronous: mark it `async`
and return the value. An early return on its own line needs no braces.

```ts
// Yes
async find(clientId?: string): Promise<ClientEntity | null> {
  if (!clientId) return null;

  return this.typeOrmRepository.findOneBy({ id: clientId });
}

// No — a Promise where a value would do
find(clientId?: string): Promise<ClientEntity | null> {
  if (!clientId) return Promise.resolve(null);
  ...
}
```

**Name what you awaited; don't inline a call into what you return.** The
name says what the value *is*, which the call site otherwise leaves to the
reader.

```ts
// Yes
const providerUrl = await this.oauthService.authorize(query);

return { url: providerUrl };

// No
return { url: await this.oauthService.authorize(query) };
```

The same applies to a call wrapped in a mapper or a response helper
(`return Dto.fromEntity(await service.find(id))`): await into a named
`const` first. A single call returned on its own — `return
this.oauthService.jwks();` — is already clear and stays as it is.

**A condition gets the same treatment**, and needs it more, since a
negated await reads backwards:

```ts
// Yes
const wasConsumed = await this.codeRepository.consumeCode(value);

if (!wasConsumed) return null;

// No
if (!(await this.codeRepository.consumeCode(value))) return null;
```

Name the check the same way when it is a comparison rather than a call
(`hasValidSecret`, `isRegisteredUri`). Splitting the branches is a
readability change only: they keep answering the same thing, for the
reasons in **Secrets**.

**A conditional spread gets a name too.** `...(x ? { y: x } : {})` inside
an object literal hides a decision in the middle of the shape being
built. Declare each one above, then spread the names, so the literal reads
as the shape it is.

```ts
// Yes
const refreshTokenField = refreshToken ? { refresh_token: refreshToken } : {};
const idTokenField = idToken ? { id_token: idToken } : {};

return {
  access_token: accessToken,
  expires_in: expiresInSeconds,
  token_type: TOKEN_TYPE,
  scope,
  ...refreshTokenField,
  ...idTokenField,
};

// No — two decisions buried in a literal
return {
  access_token: accessToken,
  ...(refreshToken ? { refresh_token: refreshToken } : {}),
  ...(idToken ? { id_token: idToken } : {}),
};
```

A plain spread of something already named (`...responseOptions`) needs
nothing; it is the inline condition that costs the reader.

**A guard clause is one line, without braces.** When the body is a bare
`return` of a value, keep it on the `if` — the braces add three lines
around a decision that takes one, and a column of them buries the work the
method actually does.

```ts
// Yes
if (!wasConsumed) return null;
if (!token || token.clientId !== clientId) return;

// No
if (!wasConsumed) {
  return null;
}
```

This is for direct returns only. A `throw`, anything that runs a statement
first, and a return whose value does not fit the line — `return
buildUrl(redirectUri, { … })` broken across lines, as in
`OauthService.authorize` — all keep their braces.

## Decorator order on a handler

Nest defines no order, and none of these decorators care: each writes its
own metadata key, so rearranging them changes nothing at runtime. It is
therefore a reading convention, and this codebase keeps one — **document,
guard, route, respond**:

```ts
@SwaggerDocs(OAUTH_SWAGGER.TOKEN)              // 1. what it is
@UseGuards(BasicTokenGuard, GrantTypeGuard)    // 2. who may enter
@Post('token')                                 // 3. where it lives
@HttpCode(HttpStatus.OK)                       // 4. what comes back
@Header('Cache-Control', 'no-store')
```

Class level, same idea: `@ApiTags` then `@Controller`.

**Two places where order is load-bearing, and they are not this list:**

- **Inside `@UseGuards(A, B)`.** Guards run left to right.
  `BasicTokenGuard, GrantTypeGuard` is not alphabetical: the second reads
  the `client` the first put on the request. Swapped, the token endpoint
  fails at request time.
- **Two decorators writing the same key** — a second `@HttpCode`, say.
  TypeScript applies decorators bottom-up, so which one survives is a
  question you should never have to ask. Don't duplicate.

## CRUD methods have fixed names

**A method that is plainly a CRUD operation uses the standard name**, in
every repository and every service, with no synonyms invented per module:

| Operation | Name |
| --- | --- |
| Read one, by the entity's own `id` | `find` |
| Read many | `findAll` |
| Write a new one | `create` |
| Change an existing one | `update` |
| Delete one | `remove` |

Don't write `findById`, `getOne`, `fetch`, `store`, `save`, `deleteById`
or `destroy` for these. The id is the only thing `find` ever takes, so
naming it in the method says nothing; and a reader who has learned one
repository should not have to relearn the next.

**A lookup by anything other than the id keeps saying so** —
`UserRepository.findByEmail`. That is not a synonym for `find`, it is a
different question. `ClientRepository.find` is *not* one of these:
`ClientEntity.id` **is** the `client_id`, so it is the ordinary case.

**A repository serving two entities names which one** —
`CodeRepository` has `createRequest`/`findRequest` and
`createCode`/`findCode`, because one bare `find` could not say. The verb
is still the standard one; only the noun is added.

The library's own API is not covered by any of this: inside a repository,
`this.typeOrmRepository.save(...)` stays `save`.

**A method that carries domain meaning keeps its own name**, and this is
the part not to over-apply. `claimRequest`, `consumeCode`, `revokeSession`
and `rotate` are not CRUD dressed up: each one names a rule — single use,
rotation, the end of a session — that `update` or `remove` would erase.
The test: **would `update` tell the reader what just became true?** If
not, the domain name stays.

## Method order inside a class

**Group methods by what they solve, and order the groups the way a
request moves through them** — not alphabetically, not
public-then-private, not the order the controller happens to declare its
routes.

**A group's private helpers sit inside the group**, right after the
public methods that call them. Don't sweep every private to the bottom
of the class: that separates each helper from its only caller and turns
the end of the file into an unrelated pile.

`OauthService` is the shape:

```
authorize                     ─┐
describeInteraction            │  front channel: how a sign-in starts
acceptInteraction              │  and turns into a code
private getActiveRequest      ─┘

issueTokens                   ─┐
revokeSession                  │  token endpoint: what a client exchanges
private toTokenResponse       ─┘

jwks                             neither: the verification half
```

Reading the file top to bottom then walks the protocol in the order a
client does. A method belonging to no group goes last, on its own —
resist filing it under the nearest heading. When a group outgrows what
one class should hold, that is the signal to split the class, not to add
a fourth group.

## Comments

**Only `*.util.ts` and `*.decorator.ts` carry comments**, wherever they
live — `common/utils/`, `oauth/submodules/token/utils/` and `user/user.util.ts`
today. Everywhere else — services, guards, middlewares, core, entities,
DTOs — the code stands on its own, with no `//` and no
doc block. Don't add one back while editing a file, however tempting the
RFC citation.

The exemption follows the **kind of file**, not the folder: a util is
called from places that shouldn't have to read its source, so its
contract is written down. A util that moves into a module keeps its
JSDoc.

The reasoning that used to live in those comments is in
[architecture.md](architecture.md), this file, `README.md` and
`src/core/middlewares/README.md`. **When a change needs explaining, the
explanation goes there**, where it is read before the code rather than
after. That is the trade this rule makes: one place to look, kept
current, instead of rationale scattered across files and drifting.

**Every export of an exempt file carries JSDoc.**
These are helpers and decorators called from places that shouldn't need
to read their source, so they get a real doc block:

- a one-line summary of what the function does, then any behaviour worth
  knowing (why a check exists, what is cached, what is deliberately
  absent) as prose in the description
- `@param` per argument, describing what it is rather than restating its
  type
- `@returns` describing the value, not just its type
- `@throws` for each failure a caller can reasonably hit

Inside the function body, stay comment-free — if a line needs
explaining, the explanation belongs in the doc block above it.

## Secrets: client secrets stored as issued, passwords not here

- **Client secrets** are stored **as issued**, in plaintext
  (`ClientEntity.clientSecret`), and checked in `BasicTokenGuard`.
- **User passwords are the identity side's, and never reach the oauth
  side.** They live bcrypt-hashed in the `user` module (`users`), which
  checks them at `/users/verify` for the login app and nobody else. The
  oauth side is told the result — who signed in — through the
  key-guarded `accept`.
- **The API key** (`ADMIN_API_KEY`) comes from the environment only.

Comparisons outside a library must be **constant-time**, through
`constantTimeEquals` in `@common/utils/crypto.util` — `crypto.timingSafeEqual`
behind a length check, not `===`, since a plaintext secret compared with
`===` leaks itself one character at a time through response latency.

**Every "no" looks the same**, and costs the same. An unknown email and a
wrong password both leave `/users/verify` as one `UnauthorizedException`
with one message: a separate "user not found" turns the endpoint into a
list of which emails are registered. The cost matters as much as the
status — returning early when there is no user answers in microseconds
while a wrong password pays the full bcrypt cost factor, and that gap
alone is the same disclosure. Hash against `DUMMY_PASSWORD_HASH` instead,
then decide. Splitting the check across several statements is fine; giving
the branches different answers is not.

**Trade-off, accepted knowingly:** anyone with read access to the
`clients` collection — a leaked backup, an over-broad database grant —
obtains every client credential directly. Hashing would remove that
exposure; RFC 6819 §5.1.4.1.3 recommends it, and this repo does not
follow that recommendation for client secrets. If you add hashing, the
guard's comparison changes with it.

## Tokens: one place to issue, one place a session ends

**There is exactly one place a token is issued: `POST /oauth/token`**,
through `TokenService`. A second issuance path — a `/login` facade, a
helper that signs its own JWT — is a second thing to keep in sync, and
the first one to drift.

- **An access token is a JWT, verified offline**, so nothing can
  withdraw one before its `exp`. That is the accepted trade-off for a
  verifier that needs no database; keep the lifetime short rather than
  adding a denylist that every resource server would have to consult.
- **A `revoked: boolean` claim cannot work.** A JWT is signed and
  immutable once issued; revocation is mutable server-side state, and
  that asymmetry is why it needs a lookup.
- **A refresh token is opaque, and its value is its document id** — 256
  bits of randomness, which is the only thing making it unguessable.
  Nothing derives or decodes it.
- **A session ends by deleting its refresh tokens**, all of them, by
  `sessionId` — or on its own at its fixed end. Deleting happens today on
  reuse of a consumed token and on `POST /oauth/revoke` (RFC 7009), which
  a client calls when someone signs out. **Revoking answers 200 either
  way** — for an unknown token and for another client's — or it would be
  an oracle for guessing tokens. A revocation by `subject`, for the
  identity side to push, would end a session the same way — it is not
  written yet.
- **A session has a fixed end, and rotation never moves it.**
  `sessionExpiresAt` is set once, at sign-in, and copied onto every
  rotated token; each token's `expiresAt` is capped at it. A sliding
  window — each rotation granting a fresh `REFRESH_TOKEN_TTL_SECONDS` —
  would let a session that is used often enough live forever, and never
  send the person back to be vouched for again.
- **`signAccessToken` generates the `jti` itself** — excluded from its
  `claims` parameter's type, not merely defaulted. RFC 9068 §2.2
  requires one, and generating it there means no caller can mint two
  tokens sharing an identifier.
- **A refresh never asks the `user` module anything.** A person deleted
  there keeps a live session until its fixed end, or until the identity
  side asks for a revocation by `subject` (not written yet). Access
  tokens already issued still verify until `exp` either way.

## `ObjectId` comes from `mongodb`, not from `typeorm`

TypeORM 1.1 stopped re-exporting `ObjectId` from its root (it lives in
`typeorm/driver/mongodb/typings`), so `import { ObjectId } from 'typeorm'`
is a TS2305. Every entity imports the real one instead:

```ts
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import type { ObjectId } from 'mongodb';
```

`mongodb` is already a direct dependency, and this is the type the driver
actually stores — don't patch or re-declare the library's types for it.

## Express 5 route patterns

Nest 11+ runs on Express 5, which uses path-to-regexp 8 — **an unnamed
wildcard is a boot-time crash, not a warning**. `forRoutes('*')` looks
right and is what most Nest examples still show, but Nest normalises it
to `/*` and hands it straight to `app.use`
(`middleware-module.js#registerHandler`), where path-to-regexp throws
`Missing parameter name at index 2`. Use a *named* wildcard —
`forRoutes('*splat')` — or `'{*splat}'`. Verified against the installed
express@5.2.1: `/*` throws, `/*splat` and `/{*splat}` both bind.
