import { Injectable } from '@nestjs/common';
import { constantTimeEquals } from '@utils/string.util';
import { ClientEntity } from '@modules/client/client.entity';
import { UserEntity } from '@modules/user/user.entity';
import { UserRepository } from '@modules/user/user.repository';
import { OtpRepository } from '@modules/otp/otp.repository';
import { TokenService } from '@modules/token/token.service';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { ScopeService } from '@modules/oauth/scope.service';
import type {
  GrantHandler,
  OtpGrantParams,
} from '@modules/oauth/grantTypes/grantTypes.interfaces';

@Injectable()
export class OtpGrantService implements GrantHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly scopeService: ScopeService,
    private readonly tokenService: TokenService,
  ) {}

  async handle(
    client: ClientEntity,
    params: OtpGrantParams,
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

  private async authenticateUser(
    clientId: string,
    { email, otp }: OtpGrantParams,
  ): Promise<UserEntity> {
    const user = email
      ? await this.userRepository.findByClientAndEmail(clientId, email)
      : null;

    if (!user || !otp || !(await this.consumeOtp(user.id, otp))) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid otp');
    }

    return user;
  }

  // The code is only spent once it matches, and only by the request whose
  // delete actually removed the key — of two concurrent requests presenting the
  // same valid code, the second finds nothing left to delete and is rejected.
  private async consumeOtp(userId: string, otp: string): Promise<boolean> {
    const storedOtp = await this.otpRepository.find(userId);

    return (
      !!storedOtp &&
      constantTimeEquals(otp, storedOtp) &&
      (await this.otpRepository.delete(userId))
    );
  }
}
