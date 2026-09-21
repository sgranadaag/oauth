import { Inject, Injectable } from '@nestjs/common';
import type { KoaContextWithOIDC } from 'oidc-provider';
import type { OidcClient } from '@interfaces/oidcClient.interface';
import { UserRepository } from '../../user/user.repository';
import { UserEntity } from '../../user/user.entity';
import { TokenService } from '../../token/token.service';
import { OIDC_ERRORS, PASSWORD_GRANT_TYPE } from '../oidc.constants';
import type { GrantHandler } from '../interfaces/grant.interface';
import type { OidcErrors } from '../interfaces/errors.interface';
import type { PasswordGrantParams } from '../interfaces/passwordGrant.interface';
import { verifyPassword } from '@utils/password.util';

@Injectable()
export class PasswordGrantService implements GrantHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    @Inject(OIDC_ERRORS) private readonly errors: OidcErrors,
  ) { }

  async handle(context: KoaContextWithOIDC): Promise<void> {
    const client = context.oidc.client!;
    const params = context.oidc.params as PasswordGrantParams;

    const user = await this.authenticateUser(client, params);

    context.body = await this.tokenService.issue({
      context,
      client,
      user,
      grantType: PASSWORD_GRANT_TYPE,
      requestedScope: params.scope,
    });
  }

  private async authenticateUser(
    client: OidcClient,
    { username, password }: PasswordGrantParams,
  ): Promise<UserEntity> {
    const user = username
      ? await this.userRepository.findByClientAndEmail(
        client.clientId,
        username,
      )
      : null;

    if (
      !user ||
      !password ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new this.errors.InvalidGrant('invalid credentials');
    }

    return user;
  }
}
