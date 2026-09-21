import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: MongoRepository<UserEntity>,
  ) {}

  save(user: UserEntity): Promise<UserEntity> {
    return this.repository.save(user);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByClientAndEmail(
    clientId: string,
    email: string,
  ): Promise<UserEntity | null> {
    return this.repository.findOneBy({ clientId, email });
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
