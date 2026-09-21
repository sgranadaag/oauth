import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ClientEntity } from './client.entity';

@Injectable()
export class ClientRepository {
  constructor(
    @InjectRepository(ClientEntity)
    private readonly typeOrmRepository: MongoRepository<ClientEntity>,
  ) {}

  save(client: ClientEntity): Promise<ClientEntity> {
    return this.typeOrmRepository.save(client);
  }

  findByClientId(clientId: string): Promise<ClientEntity | null> {
    return this.typeOrmRepository.findOneBy({ id: clientId });
  }
}
