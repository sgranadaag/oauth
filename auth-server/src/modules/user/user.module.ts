import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientModule } from '@modules/client/client.module';
import { UserEntity } from '@modules/user/user.entity';
import { UserController } from '@modules/user/user.controller';
import { UserRepository } from '@modules/user/user.repository';
import { UserService } from '@modules/user/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), ClientModule],
  controllers: [UserController],
  providers: [UserRepository, UserService],
  exports: [UserService],
})

export class UserModule {}
