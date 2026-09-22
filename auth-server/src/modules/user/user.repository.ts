import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { UserEntity } from '@modules/user/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: MongoRepository<UserEntity>,
  ) {}

  save(user: UserEntity): Promise<UserEntity> {
    return this.repository.save(user);
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ email });
  }
}
