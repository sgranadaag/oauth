import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@modules/user/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly typeOrmRepository: Repository<UserEntity>,
  ) {}

  save(user: UserEntity): Promise<UserEntity> {
    return this.typeOrmRepository.save(user);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.typeOrmRepository.findOneBy({ id });
  }

  findByClientAndUsername(
    clientId: string,
    username: string,
  ): Promise<UserEntity | null> {
    return this.typeOrmRepository.findOneBy({ clientId, username });
  }

  async deleteById(id: string): Promise<void> {
    await this.typeOrmRepository.delete({ id });
  }
}
