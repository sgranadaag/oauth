import { Inject, Injectable } from '@nestjs/common';
import type { KoaContextWithOIDC } from 'oidc-provider';
import type { OidcClient } from '@interfaces/oidcClient.interface';
import { UserRepository } from '../../user/user.repository';
import { UserEntity } from '../../user/user.entity';
import { OtpRepository } from '../../otp/otp.repository';
import { TokenService } from '../../token/token.service';
import { OIDC_ERRORS, OTP_GRANT_TYPE } from '../oidc.constants';
import type { GrantHandler } from '../interfaces/grant.interface';
import type { OidcErrors } from '../interfaces/errors.interface';
import type { OtpGrantParams } from '../interfaces/otpGrant.interface';
import { otpMatches } from '@utils/otp.util';

@Injectable()
export class OtpGrantService implements GrantHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly tokenService: TokenService,
    @Inject(OIDC_ERRORS) private readonly errors: OidcErrors,
  ) { }

  async handle(context: KoaContextWithOIDC): Promise<void> {
    const client = context.oidc.client!;
    const params = context.oidc.params as OtpGrantParams;

    const user = await this.authenticateUser(client, params);

    context.body = await this.tokenService.issue({
      context,
      client,
      user,
      grantType: OTP_GRANT_TYPE,
      requestedScope: params.scope,
    });
  }

  private async authenticateUser(
    client: OidcClient,
    { email, otp }: OtpGrantParams,
  ): Promise<UserEntity> {
    const user = email
      ? await this.userRepository.findByClientAndEmail(client.clientId, email)
      : null;

    if (!user || !otp || !(await this.consumeOtp(user.id, otp))) {
      throw new this.errors.InvalidGrant('invalid otp');
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
      otpMatches(otp, storedOtp) &&
      (await this.otpRepository.delete(userId))
    );
  }
}
