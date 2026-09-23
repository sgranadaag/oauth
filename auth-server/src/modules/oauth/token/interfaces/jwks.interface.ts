import type { JsonWebKey } from 'node:crypto';

export interface JwkSet {
  keys: JsonWebKey[];
}
