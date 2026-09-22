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
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  acceptInteraction(
    @Param('interactionId') interactionId: string,
    @Body() dto: InteractionAcceptDto,
  ): Promise<InteractionAcceptResult> {
    return this.oauthService.acceptInteraction(interactionId, {
      id: dto.subject,
      email: dto.email,
    });
  }

  // Public by design, no guard: the public half of the signing key is exactly
  // what anyone verifying a token needs. Cacheable, since it changes only
  // when the key does — and then `kid` changes with it.
  @SwaggerDocs(OAUTH_SWAGGER.JWKS)
  @Get('jwks')
  @Header('Cache-Control', 'public, max-age=3600')
  jwks(): JwkSet {
    return this.oauthService.jwks();
  }

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
