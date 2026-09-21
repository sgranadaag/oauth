import type { KoaContextWithOIDC } from 'oidc-provider';

export type OidcClient = NonNullable<KoaContextWithOIDC['oidc']['client']>;
