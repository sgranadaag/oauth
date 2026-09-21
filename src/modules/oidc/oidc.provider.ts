import { Provider } from 'oidc-provider';
import { oidcConfig, oidcIssuer } from './oidc.config';
import type { OidcProviderDependencies } from './interfaces/provider.interface';
import { CUSTOM_GRANT_TYPES } from './grantTypes/grantTypes.registry';

export class OidcProvider extends Provider {
  constructor(private readonly dependencies: OidcProviderDependencies) {
    super(oidcIssuer(dependencies), oidcConfig(dependencies));

    this.registerCustomGrantTypes();
  }

  private registerCustomGrantTypes(): void {
    for (const { type, params, service } of CUSTOM_GRANT_TYPES) {
      this.registerGrantType(
        type,
        (context) => this.dependencies.resolveGrantHandler(service).handle(context),
        params,
      );
    }
  }
}
