import { ApiProperty } from '@nestjs/swagger';
import { ClientEntity } from '../client.entity';
import { CLIENT_PROPERTY_SWAGGER } from '../client.swagger';

export class ClientResponseDto {
  @ApiProperty(CLIENT_PROPERTY_SWAGGER.CLIENT_ID)
  readonly clientId: string;

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.CLIENT_SECRET)
  readonly clientSecret: string;

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.NAME)
  readonly name: string;

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.ALLOWED_SCOPES)
  readonly allowedScopes: string[];

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.REDIRECT_URIS)
  readonly redirectUris: string[];

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.GRANT_TYPES)
  readonly grantTypes: string[];

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.ACCESS_TOKEN_TTL_SECONDS)
  readonly accessTokenTtlSeconds: number | null;

  private constructor(
    clientId: string,
    clientSecret: string,
    name: string,
    allowedScopes: string[],
    redirectUris: string[],
    grantTypes: string[],
    accessTokenTtlSeconds: number | null,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.name = name;
    this.allowedScopes = allowedScopes;
    this.redirectUris = redirectUris;
    this.grantTypes = grantTypes;
    this.accessTokenTtlSeconds = accessTokenTtlSeconds;
  }

  static fromEntity(
    client: ClientEntity,
    plainSecret: string,
  ): ClientResponseDto {
    return new ClientResponseDto(
      client.id,
      plainSecret,
      client.name,
      client.allowedScopes,
      client.redirectUris,
      client.grantTypes,
      client.accessTokenTtlSeconds,
    );
  }
}
