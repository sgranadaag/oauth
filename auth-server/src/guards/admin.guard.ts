import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ENV } from '@constants/environment.constant';
import { constantTimeEquals } from '@utils/string.util';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.configService.get<string>(ENV.ADMIN_API_KEY);
    if (!configuredKey) {
      throw new ForbiddenException('Admin credential is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-admin-key');

    if (!providedKey || !constantTimeEquals(providedKey, configuredKey)) {
      throw new ForbiddenException('Invalid admin credential');
    }

    return true;
  }
}
