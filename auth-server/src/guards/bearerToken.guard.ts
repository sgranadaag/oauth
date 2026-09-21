import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@constants/environment.constant';
import type { BearerTokenRequest } from '@interfaces/authenticatedRequest.interface';
import { verifyAccessToken } from '@utils/jwt.util';
import {
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
} from '@modules/token/token.constants';

@Injectable()
export class BearerTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<BearerTokenRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Malformed bearer token');
    }

    try {
      request.token = verifyAccessToken(token, {
        issuer:
          this.configService.get<string>(ENV.OIDC_ISSUER) ?? DEFAULT_ISSUER,
        audience: DEFAULT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }
}
