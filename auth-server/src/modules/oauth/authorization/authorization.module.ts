import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeValueEntity } from '@modules/oauth/authorization/entities/codeValue.entity';
import { RequestEntity } from '@modules/oauth/authorization/entities/request.entity';
import { AuthorizationRepository } from '@modules/oauth/authorization/authorization.repository';
import { AuthorizationService } from '@modules/oauth/authorization/authorization.service';

@Module({
  imports: [TypeOrmModule.forFeature([RequestEntity, CodeValueEntity])],
  providers: [AuthorizationRepository, AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
