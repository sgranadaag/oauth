import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ClientEntity } from './client.entity';
import { ClientRepository } from './client.repository';
import type { CreateClientResult } from './interfaces/createClient.interface';

@Injectable()
export class ClientService {
  constructor(private readonly clientRepository: ClientRepository) {}

  async create(
    name: string,
    allowedScopes: string[],
  ): Promise<CreateClientResult> {
    const clientSecret = randomUUID();

    const client = new ClientEntity();
    client.id = randomUUID();
    client.clientSecret = clientSecret;
    client.name = name;
    client.allowedScopes = allowedScopes;

    const saved = await this.clientRepository.save(client);

    return { client: saved, plainSecret: clientSecret };
  }
}
