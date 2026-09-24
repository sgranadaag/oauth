import type { ClientEntity } from '../client.entity';

export interface CreateClientInput {
  name: string;
  allowedScopes: string[];
  redirectUris: string[];

  isPublic?: boolean;
  grantTypes?: string[];
  accessTokenTtlSeconds?: number;
}

export interface CreateClientResult {
  client: ClientEntity;

  plainSecret: string;
}
