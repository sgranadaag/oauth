import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@decorators/swaggerDocs.decorator';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import type { BasicTokenRequest } from '@interfaces/authenticatedRequest.interface';
import { OauthService } from '@modules/oauth/oauth.service';
import { OAUTH_SWAGGER } from '@modules/oauth/oauth.swagger';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/interfaces/tokenEndpoint.interface';

@ApiTags(OAUTH_SWAGGER.API_TAG)
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  // The client comes from the Basic credentials the guard verified, never from
  // the body — a caller can only ever mint tokens for a client whose secret it
  // holds. `no-store` is RFC 6749 §5.1: the body carries a live credential.
  @SwaggerDocs(OAUTH_SWAGGER.TOKEN)
  @UseGuards(BasicTokenGuard)
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async token(
    @Req() request: BasicTokenRequest,
    @Body() params: TokenRequestParams,
  ): Promise<TokenResponse> {
    return this.oauthService.token(request.client, params);
  }
}
