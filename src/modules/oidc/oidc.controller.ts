import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Provider } from 'oidc-provider';
import { SwaggerDocs } from '@decorators/swaggerDocs.decorator';
import { OIDC_MOUNT_PATH, OIDC_PROVIDER } from '@modules/oidc/oidc.constants';
import { OIDC_SWAGGER } from '@modules/oidc/oidc.swagger';

@ApiTags(OIDC_SWAGGER.API_TAG)
@Controller('oauth')
export class OidcController {
  private readonly callback: (req: Request, res: Response) => Promise<void>;

  constructor(@Inject(OIDC_PROVIDER) provider: Provider) {
    this.callback = provider.callback();
  }

  @SwaggerDocs(OIDC_SWAGGER.TOKEN)
  @Post('token')
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @SwaggerDocs(OIDC_SWAGGER.REVOCATION)
  @Post('token/revocation')
  async revocation(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @SwaggerDocs(OIDC_SWAGGER.JWKS)
  @Get('jwks')
  async jwks(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  private async forward(req: Request, res: Response): Promise<void> {
    req.url = req.originalUrl.replace(OIDC_MOUNT_PATH, '');
    await this.callback(req, res);
  }
}
