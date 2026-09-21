import type { Type } from '@nestjs/common';
import type { ClientEntity } from '@modules/client/client.entity';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import type { TokenRequestParams } from '@modules/oauth/interfaces/tokenEndpoint.interface';

export interface GrantHandler {
  handle(
    client: ClientEntity,
    params: TokenRequestParams,
  ): Promise<IssuedTokens>;
}

export interface GrantTypeRegistration {
  type: string;
  service: Type<GrantHandler>;
}

// `username` is the RFC 6749 §4.3.2 parameter name, kept so standard ROPC
// clients work unchanged — its value is the user's email.
export interface PasswordGrantParams extends TokenRequestParams {
  username?: string;
  password?: string;
}

export interface OtpGrantParams extends TokenRequestParams {
  email?: string;
  otp?: string;
}

export interface RefreshTokenGrantParams extends TokenRequestParams {
  refresh_token?: string;
}
