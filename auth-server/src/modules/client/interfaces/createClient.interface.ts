import type { ClientEntity } from '../client.entity';

export interface CreateClientInput {
  name: string;
  allowedScopes: string[];
  redirectUris: string[];

  grantTypes?: string[];
  accessTokenTtlSeconds?: number;
}

export interface CreateClientResult {
  client: ClientEntity;
  plainSecret: string;
}
