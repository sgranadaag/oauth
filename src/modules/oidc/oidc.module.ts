import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { errors } from 'oidc-provider';
import { ClientModule } from '../client/client.module';
import { ClientRepository } from '../client/client.repository';
import { OtpModule } from '../otp/otp.module';
import { TokenModule } from '../token/token.module';
import { UserModule } from '../user/user.module';
import { UserRepository } from '../user/user.repository';
import { OidcController } from './oidc.controller';
import { OidcModelEntity } from './oidc.entity';
import { OidcProvider } from './oidc.provider';
import { CUSTOM_GRANT_TYPES } from './grantTypes/grantTypes.registry';
import { OIDC_ERRORS, OIDC_PROVIDER } from './oidc.constants';

// Every custom grant service becomes a provider, so ModuleRef can resolve it
// below. Derived from the registry rather than listed by hand — adding a grant
// touches only grantTypes.registry.ts.
const grantTypeProviders = CUSTOM_GRANT_TYPES.map((grant) => grant.service);

@Module({
  imports: [
    TypeOrmModule.forFeature([OidcModelEntity]),
    ClientModule,
    UserModule,
    OtpModule,
    TokenModule,
  ],
  controllers: [OidcController],
  providers: [
    ...grantTypeProviders,
    { provide: OIDC_ERRORS, useValue: errors },
    {
      provide: OIDC_PROVIDER,
      inject: [
        ConfigService,
        getRepositoryToken(OidcModelEntity),
        ClientRepository,
        UserRepository,
        ModuleRef,
      ],
      useFactory: (
        configService: ConfigService,
        oidcModelRepository: Repository<OidcModelEntity>,
        clientRepository: ClientRepository,
        userRepository: UserRepository,
        moduleRef: ModuleRef,
      ) =>
        new OidcProvider({
          configService,
          oidcModelRepository,
          clientRepository,
          userRepository,
          resolveGrantHandler: (service) => moduleRef.get(service),
        }),
    },
  ],
  exports: [TypeOrmModule],
})
export class OidcModule {}
