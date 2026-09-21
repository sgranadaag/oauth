import type { Request } from 'express';
import type { AccessTokenClaims } from '@interfaces/accessToken.interface';
import type { ClientEntity } from '@modules/client/client.entity';

// The whole client, not just its id: BasicTokenGuard has to read it to verify
// the secret, so anything downstream needing `allowedScopes` would otherwise
// read the same document a second time.
export interface BasicTokenRequest extends Request {
  client: ClientEntity;
}

export interface BearerTokenRequest extends Request {
  token: AccessTokenClaims;
}
