import type { Type } from '@nestjs/common';
import type { KoaContextWithOIDC } from 'oidc-provider';

export interface GrantHandler {
  handle(context: KoaContextWithOIDC): Promise<void>;
}

export interface GrantTypeRegistration {
  type: string;
  params: string[];
  service: Type<GrantHandler>;
}

export type GrantHandlerResolver = (
  service: Type<GrantHandler>,
) => GrantHandler;
