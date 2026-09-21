import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ENV } from '@constants/environment.constant';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.configService.get<string>(ENV.ADMIN_API_KEY);
    if (!configuredKey) {
      throw new UnauthorizedException('Admin credential is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-admin-key');

    if (!providedKey || providedKey !== configuredKey) {
      throw new UnauthorizedException('Invalid admin credential');
    }

    return true;
  }
}
