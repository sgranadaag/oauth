import type { ClientEntity } from '../client.entity';

export interface CreateClientInput {
  name: string;
  allowedScopes: string[];
  redirectUris: string[];
  // Both optional: a registration that says nothing gets the interactive
  // grants and the server's own token lifetime.
  grantTypes?: string[];
  accessTokenTtlSeconds?: number;
}

export interface CreateClientResult {
  client: ClientEntity;
  plainSecret: string;
}
