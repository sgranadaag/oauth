import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientModule } from '@modules/client/client.module';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import { UserEntity } from '@modules/user/user.entity';
import { UserController } from '@modules/user/user.controller';
import { UserRepository } from '@modules/user/user.repository';
import { UserService } from '@modules/user/user.service';

@Module({
  imports: [ClientModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [UserRepository, UserService, BasicTokenGuard],
  exports: [UserRepository],
})
export class UserModule {}
