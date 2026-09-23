import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@decorators/swaggerDocs.decorator';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import { GrantTypeGuard } from '@guards/grantType.guard';
import { AdminGuard } from '@guards/admin.guard';
import type { BasicTokenRequest } from '@interfaces/authenticatedRequest.interface';
import type { JwkSet } from '@interfaces/jwks.interface';
import { OauthService } from '@modules/oauth/oauth.service';
import { OAUTH_SWAGGER } from '@modules/oauth/oauth.swagger';
import { InteractionAcceptDto } from '@modules/oauth/dto/interactionAccept.dto';
import type {
  AuthorizeQuery,
  InteractionAcceptResult,
  InteractionDetails,
} from '@modules/oauth/interfaces/authorizeEndpoint.interface';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/interfaces/tokenEndpoint.interface';
import type { RevokeRequestParams } from '@modules/oauth/interfaces/revokeEndpoint.interface';

@ApiTags(OAUTH_SWAGGER.API_TAG)
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @SwaggerDocs(OAUTH_SWAGGER.AUTHORIZE)
  @Get('authorize')
  @Redirect()
  async authorize(@Query() query: AuthorizeQuery): Promise<{ url: string }> {
    const providerUrl = await this.oauthService.authorize(query)
    return { url: providerUrl };
  }

  @SwaggerDocs(OAUTH_SWAGGER.INTERACTION)
  @UseGuards(AdminGuard)
  @Get('interactions/:interactionId')
  interaction(
    @Param('interactionId') interactionId: string,
  ): Promise<InteractionDetails> {
    return this.oauthService.interaction(interactionId);
  }

  @SwaggerDocs(OAUTH_SWAGGER.INTERACTION_ACCEPT)
  @UseGuards(AdminGuard)
  @Post('interactions/:interactionId/accept')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  acceptInteraction(
    @Param('interactionId') interactionId: string,
    @Body() dto: InteractionAcceptDto,
  ): Promise<InteractionAcceptResult> {
    return this.oauthService.acceptInteraction(interactionId, {
      id: dto.subject,
      email: dto.email,
    });
  }

  // RFC 7009. Same client credentials as the token endpoint, and the same
  // `no-store`: the body carries a live credential on its way to being
  // destroyed. No content comes back — 200 is the whole answer.
  @SwaggerDocs(OAUTH_SWAGGER.REVOKE)
  @UseGuards(BasicTokenGuard)
  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async revoke(
    @Req() request: BasicTokenRequest,
    @Body() params: RevokeRequestParams,
  ): Promise<void> {
    await this.oauthService.revoke(request.client, params);
  }

  @SwaggerDocs(OAUTH_SWAGGER.JWKS)
  @Get('jwks')
  @Header('Cache-Control', 'public, max-age=3600')
  jwks(): JwkSet {
    return this.oauthService.jwks();
  }

  @SwaggerDocs(OAUTH_SWAGGER.TOKEN)
  @UseGuards(BasicTokenGuard, GrantTypeGuard)
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
