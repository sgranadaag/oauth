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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SwaggerDocs } from '@common/decorators/swaggerDocs.decorator';
import { BasicTokenGuard } from '@common/guards/basicToken.guard';
import type {
  AuthorizeRequest,
  BasicTokenRequest,
} from '@common/interfaces/authenticatedRequest.interface';
import { OAUTH_SWAGGER } from '@modules/oauth/oauth.swagger';
import {
  MILLISECONDS_PER_SECOND,
  OAUTH_ERRORS,
  TOKEN_TYPE_HINTS,
} from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { InteractionLoginDto } from '@modules/oauth/dto/interactionLogin.dto';
import { SignInService } from '@modules/oauth/flows/signIn/signIn.service';
import { TokenExchangeService } from '@modules/oauth/flows/tokenExchange/tokenExchange.service';
import { TokenService } from '@modules/oauth/token/token.service';
import { getPublicJwks } from '@modules/oauth/token/utils/keys.util';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@modules/oauth/session/session.constants';
import type {
  AuthorizeQuery,
  InteractionDetails,
} from '@modules/oauth/flows/signIn/interfaces/signIn.interface';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/flows/tokenExchange/interfaces/tokenExchange.interface';
import type { RevokeRequestParams } from '@modules/oauth/interfaces/revokeEndpoint.interface';
import type { JwkSet } from '@modules/oauth/token/interfaces/jwks.interface';

@ApiTags(OAUTH_SWAGGER.API_TAG)
@Controller('oauth')
export class OauthController {
  constructor(
    private readonly signInService: SignInService,
    private readonly tokenExchangeService: TokenExchangeService,
    private readonly tokenService: TokenService,
  ) {}

  @SwaggerDocs(OAUTH_SWAGGER.AUTHORIZE)
  @Get('authorize')
  @Redirect()
  async authorize(
    @Req() request: AuthorizeRequest,
    @Query() query: AuthorizeQuery,
  ): Promise<{ url: string }> {
    const url = await this.signInService.start(
      query,
      request.cookies?.[SESSION_COOKIE],
    );

    return { url };
  }

  @SwaggerDocs(OAUTH_SWAGGER.INTERACTION)
  @Get('interactions/:interactionId')
  describeInteraction(
    @Param('interactionId') interactionId: string,
  ): Promise<InteractionDetails> {
    return this.signInService.describe(interactionId);
  }

  @SwaggerDocs(OAUTH_SWAGGER.INTERACTION_LOGIN)
  @Post('interactions/:interactionId/login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async loginInteraction(
    @Param('interactionId') interactionId: string,
    @Body() dto: InteractionLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ redirectTo: string }> {
    const { redirectTo, sessionId } = await this.signInService.complete(
      interactionId,
      dto,
    );

    response.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    });

    return { redirectTo };
  }

  @SwaggerDocs(OAUTH_SWAGGER.TOKEN)
  @UseGuards(BasicTokenGuard)
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  issueTokens(
    @Req() request: BasicTokenRequest,
    @Body() params: TokenRequestParams,
  ): Promise<TokenResponse> {
    return this.tokenExchangeService.exchange(request.client, params);
  }

  @SwaggerDocs(OAUTH_SWAGGER.REVOKE)
  @UseGuards(BasicTokenGuard)
  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async revokeSession(
    @Req() request: BasicTokenRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() params: RevokeRequestParams,
  ): Promise<void> {
    if (!params.token) {
      throw new OauthException(OAUTH_ERRORS.INVALID_REQUEST, 'token is required');
    }

    const hint = params.token_type_hint;
    if (hint && !TOKEN_TYPE_HINTS.includes(hint)) {
      throw new OauthException(
        OAUTH_ERRORS.UNSUPPORTED_TOKEN_TYPE,
        `${hint} is not a token type this server stores`,
      );
    }

    const sessionId = request.cookies?.[SESSION_COOKIE];
    await this.signInService.endSession(sessionId, request.client.id);

    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    await this.tokenService.revokeSession(params.token, request.client.id);
  }

  @SwaggerDocs(OAUTH_SWAGGER.JWKS)
  @Get('jwks')
  @Header('Cache-Control', 'public, max-age=3600')
  jwks(): JwkSet {
    return getPublicJwks();
  }
}
