import { Injectable } from '@nestjs/common';
import { AuthorizationService } from '@modules/oauth/authorization/authorization.service';
import { SessionService } from '@modules/oauth/session/session.service';
import { TokenService } from '@modules/oauth/token/token.service';
import type { ClearedRecords } from '@modules/manager/interfaces/manager.interface';

@Injectable()
export class ManagerService {
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
  ) {}

  async clearAll(): Promise<ClearedRecords> {
    const { requests, codes } = await this.authorizationService.removeAll();
    const sessions = await this.sessionService.removeAll();
    const tokens = await this.tokenService.removeAll();

    return { requests, codes, sessions, tokens };
  }
}
