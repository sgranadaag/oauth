import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DEFAULT_GRANT_TYPES } from './client.constants';
import { ClientEntity } from './client.entity';
import { ClientRepository } from './client.repository';
import type {
  CreateClientInput,
  CreateClientResult,
} from '@modules/client/interfaces/createClient.interface';

@Injectable()
export class ClientService {
  constructor(private readonly clientRepository: ClientRepository) {}

  async create({
    name,
    allowedScopes,
    redirectUris,
    grantTypes,
    accessTokenTtlSeconds,
  }: CreateClientInput): Promise<CreateClientResult> {
    const clientSecret = randomUUID();

    const client = new ClientEntity();
    client.id = randomUUID();
    client.clientSecret = clientSecret;
    client.name = name;
    client.allowedScopes = allowedScopes;
    client.redirectUris = redirectUris;
    client.grantTypes = grantTypes ?? DEFAULT_GRANT_TYPES;
    client.accessTokenTtlSeconds = accessTokenTtlSeconds ?? null;

    const saved = await this.clientRepository.save(client);

    return { client: saved, plainSecret: clientSecret };
  }
}
