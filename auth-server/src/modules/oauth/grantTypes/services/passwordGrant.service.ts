import { Injectable } from '@nestjs/common';
import { verifyPassword } from '@utils/password.util';
import { ClientEntity } from '@modules/client/client.entity';
import { UserEntity } from '@modules/user/user.entity';
import { UserRepository } from '@modules/user/user.repository';
import { TokenService } from '@modules/token/token.service';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { ScopeService } from '@modules/oauth/scope.service';
import type {
  GrantHandler,
  PasswordGrantParams,
} from '@modules/oauth/grantTypes/grantTypes.interfaces';

@Injectable()
export class PasswordGrantService implements GrantHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly scopeService: ScopeService,
    private readonly tokenService: TokenService,
  ) {}

  async handle(
    client: ClientEntity,
    params: PasswordGrantParams,
  ): Promise<IssuedTokens> {
    const user = await this.authenticateUser(client.id, params);
    const scope = this.scopeService.narrow(
      client.allowedScopes.join(' '),
      params.scope,
    );

    return this.tokenService.issue({
      clientId: client.id,
      userId: user.id,
      scope,
    });
  }

  // One failure for every cause — unknown email, wrong password, missing
  // field — so the response cannot be used to find out which emails exist.
  private async authenticateUser(
    clientId: string,
    { username, password }: PasswordGrantParams,
  ): Promise<UserEntity> {
    const user = username
      ? await this.userRepository.findByClientAndEmail(clientId, username)
      : null;

    if (
      !user ||
      !password ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_GRANT,
        'invalid credentials',
      );
    }

    return user;
  }
}
