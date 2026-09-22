import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationCodeEntity } from '@modules/authorization/authorizationCode.entity';
import { AuthorizationRequestEntity } from '@modules/authorization/authorizationRequest.entity';
import { AuthorizationRepository } from '@modules/authorization/authorization.repository';
import { AuthorizationService } from '@modules/authorization/authorization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthorizationRequestEntity,
      AuthorizationCodeEntity,
    ]),
  ],
  providers: [AuthorizationRepository, AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
