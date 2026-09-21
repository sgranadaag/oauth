import type { Configuration } from 'oidc-provider';
import { ENV } from '@constants/environment.constant';
import type { OidcProviderDependencies } from './interfaces/provider.interface';
import { SIGNING_ALGORITHM, getSigningJwks } from '@utils/keys.util';
import { OidcAdapter } from './oidc.adapter';
import {
  DEFAULT_OIDC_ISSUER,
  DEFAULT_RESOURCE_INDICATOR,
  OFFLINE_ACCESS_SCOPE,
  SUPPORTED_SCOPES,
} from './oidc.constants';

export function oidcIssuer({
  configService,
}: OidcProviderDependencies): string {
  return configService.get<string>(ENV.OIDC_ISSUER) ?? DEFAULT_OIDC_ISSUER;
}

export function oidcConfig({
  oidcModelRepository,
  clientRepository,
  userRepository,
}: OidcProviderDependencies): Configuration {
  return {
    adapter: (modelName: string) =>
      new OidcAdapter(modelName, oidcModelRepository, clientRepository),
    // The library's default resolves every `sub` to a stub account, which
    // would let a deleted user's refresh token keep minting access tokens —
    // the refresh grant calls this and rejects with `invalid_grant` only when
    // it returns undefined. Resolving against the real table is what makes
    // deleting a user end their sessions.
    findAccount: async (_context, accountId) => {
      const user = await userRepository.findById(accountId);
      if (!user) {
        return undefined;
      }
      return { accountId, claims: () => ({ sub: accountId }) };
    },
    clients: [],
    scopes: [...SUPPORTED_SCOPES, OFFLINE_ACCESS_SCOPE],
    jwks: getSigningJwks(),
    rotateRefreshToken: true,
    features: {
      // On by default and dev-only: it serves the library's own login/consent
      // screens at /interaction/:uid. Nothing here needs them — the three
      // supported grants are all non-interactive, and OidcController never
      // mounts those routes — so it is turned off rather than left warning.
      devInteractions: { enabled: false },
      clientCredentials: { enabled: true },
      // RFC 7009. Off by default in the library. This is how a session ends:
      // the adapter deletes the token — and, for a refresh token, consumes the
      // grant behind it — from `oidc_models`. There is no revocation list of
      // our own; the token store is the source of truth.
      revocation: { enabled: true },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => DEFAULT_RESOURCE_INDICATOR,
        getResourceServerInfo: (_ctx, _resourceIndicator, client) => ({
          scope: client.scope ?? '',
          accessTokenFormat: 'jwt',
          jwt: { sign: { alg: SIGNING_ALGORITHM } },
        }),
      },
    },
  };
}
