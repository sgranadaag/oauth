import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { errors } from 'oidc-provider';
import { ClientModule } from '@modules/client/client.module';
import { ClientRepository } from '@modules/client/client.repository';
import { UserModule } from '@modules/user/user.module';
import { UserRepository } from '@modules/user/user.repository';
import { OidcController } from '@modules/oidc/oidc.controller';
import { OidcModelEntity } from '@modules/oidc/oidc.entity';
import { OidcProvider } from '@modules/oidc/oidc.provider';
import { CUSTOM_GRANT_TYPES } from '@modules/oidc/grantTypes/grantTypes.registry';
import { OIDC_ERRORS, OIDC_PROVIDER } from '@modules/oidc/oidc.constants';

// Every custom grant service becomes a provider, so ModuleRef can resolve it
// below. Derived from the registry rather than listed by hand — adding a grant
// touches only grantTypes.registry.ts.
const grantTypeProviders = CUSTOM_GRANT_TYPES.map((grant) => grant.service);

@Module({
  imports: [
    TypeOrmModule.forFeature([OidcModelEntity]),
    ClientModule,
    UserModule,
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
