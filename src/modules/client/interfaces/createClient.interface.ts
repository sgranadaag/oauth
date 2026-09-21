import type { ClientEntity } from '../client.entity';

export interface CreateClientResult {
  client: ClientEntity;
  plainSecret: string;
}
