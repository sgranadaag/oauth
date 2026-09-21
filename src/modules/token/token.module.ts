import { Module } from '@nestjs/common';
import { errors } from 'oidc-provider';
import { ClientModule } from '../client/client.module';
import { OIDC_ERRORS } from '../oidc/oidc.constants';
import { TokenService } from './token.service';

@Module({
  imports: [ClientModule],
  providers: [TokenService, { provide: OIDC_ERRORS, useValue: errors }],
  exports: [TokenService],
})
export class TokenModule {}
