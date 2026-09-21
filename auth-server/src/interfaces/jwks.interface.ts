import type { JsonWebKey } from 'node:crypto';

/** RFC 7517 JSON Web Key Set, as `GET /oauth/jwks` publishes it. */
export interface JwkSet {
  keys: JsonWebKey[];
}
