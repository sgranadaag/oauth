import { Provider } from 'oidc-provider';
import { oidcConfig, oidcIssuer } from '@modules/oidc/oidc.config';
import type { OidcProviderDependencies } from '@modules/oidc/oidc.interfaces';
import { CUSTOM_GRANT_TYPES } from '@modules/oidc/grantTypes/grantTypes.registry';

export class OidcProvider extends Provider {
  constructor(private readonly dependencies: OidcProviderDependencies) {
    super(oidcIssuer(dependencies), oidcConfig(dependencies));

    this.registerCustomGrantTypes();
  }

  // Driven entirely off the registry: adding a grant means writing its service
  // and appending one entry there, with no change here.
  //
  // The handler is resolved inside the request callback, not here. This class is
  // built by OidcModule's own factory, so at construction time the grant
  // services are still mid-initialisation and ModuleRef hands back a placeholder
  // whose constructor dependencies are undefined. Resolving per request happens
  // after the container is fully built. Nest caches singletons, so this is a map
  // lookup, not a re-instantiation.
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
