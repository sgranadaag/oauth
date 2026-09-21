import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientModule } from '../client/client.module';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import { UserEntity } from './user.entity';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  imports: [ClientModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [UserRepository, UserService, BasicTokenGuard],
  exports: [UserRepository],
})
export class UserModule {}
