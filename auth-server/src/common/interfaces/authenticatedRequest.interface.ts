import type { Request } from 'express';
import type { ClientEntity } from '@modules/client/client.entity';

export interface BasicTokenRequest extends Request {
  client: ClientEntity;
}
