import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { BasicTokenRequest } from '@interfaces/authenticatedRequest.interface';
import { constantTimeEquals } from '@utils/string.util';
import { ClientRepository } from '../modules/client/client.repository';

@Injectable()
export class BasicTokenGuard implements CanActivate {
  constructor(private readonly clientRepository: ClientRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BasicTokenRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing client credentials');
    }

    const decoded = Buffer.from(
      header.slice('Basic '.length),
      'base64',
    ).toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Malformed client credentials');
    }
    const clientId = decoded.slice(0, separatorIndex);
    const clientSecret = decoded.slice(separatorIndex + 1);

    const client = await this.clientRepository.findByClientId(clientId);
    if (!client || !constantTimeEquals(clientSecret, client.clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    request.client = client;
    return true;
  }
}
