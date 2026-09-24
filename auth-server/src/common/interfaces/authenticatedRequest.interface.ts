import type { Request } from 'express';
import type { ClientEntity } from '@modules/client/client.entity';

export interface BasicTokenRequest extends Request {
  client: ClientEntity;

  cookies: Record<string, string | undefined>;
}

export interface AuthorizeRequest extends Request {
  client: ClientEntity;
  redirectUri: string;

  cookies: Record<string, string | undefined>;
}
