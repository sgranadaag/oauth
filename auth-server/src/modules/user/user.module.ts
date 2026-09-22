import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@modules/user/user.entity';
import { UserController } from '@modules/user/user.controller';
import { UserRepository } from '@modules/user/user.repository';
import { UserService } from '@modules/user/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [UserRepository, UserService],
})
// Deliberately exports nothing: the oauth module never asks this one about a
// person. It learns who signed in from the login app's `accept`, which the
// login app builds by calling `/users/verify` from outside. Same process,
// same database, no call between the two.
export class UserModule {}
