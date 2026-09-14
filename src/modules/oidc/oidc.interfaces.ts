import type { Type } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { KoaContextWithOIDC } from 'oidc-provider';
import type { ClientRepository } from '@modules/client/client.repository';
import type { UserRepository } from '@modules/user/user.repository';
import type { OidcModelEntity } from '@modules/oidc/oidc.entity';

export type OidcErrors = typeof import('oidc-provider').errors;

export interface GrantHandler {
  handle(context: KoaContextWithOIDC): Promise<void>;
}

export interface GrantTypeRegistration {
  type: string;
  params: string[];
  service: Type<GrantHandler>;
}

export type GrantHandlerResolver = (
  service: Type<GrantHandler>,
) => GrantHandler;

export interface OidcProviderDependencies {
  configService: ConfigService;
  oidcModelRepository: Repository<OidcModelEntity>;
  clientRepository: ClientRepository;
  userRepository: UserRepository;
  resolveGrantHandler: GrantHandlerResolver;
}
