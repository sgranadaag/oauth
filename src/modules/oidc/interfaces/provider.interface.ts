import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { ClientRepository } from '../../client/client.repository';
import type { UserRepository } from '../../user/user.repository';
import type { OidcModelEntity } from '../oidc.entity';
import type { GrantHandlerResolver } from './grant.interface';

export interface OidcProviderDependencies {
  configService: ConfigService;
  oidcModelRepository: Repository<OidcModelEntity>;
  clientRepository: ClientRepository;
  userRepository: UserRepository;
  resolveGrantHandler: GrantHandlerResolver;
}
