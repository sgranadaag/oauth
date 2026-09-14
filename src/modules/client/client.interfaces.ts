import type { ClientEntity } from '@modules/client/client.entity';

export interface CreateClientResult {
  client: ClientEntity;
  plainSecret: string;
}
