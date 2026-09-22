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

  private constructor(
    clientId: string,
    clientSecret: string,
    name: string,
    allowedScopes: string[],
    redirectUris: string[],
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.name = name;
    this.allowedScopes = allowedScopes;
    this.redirectUris = redirectUris;
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
    );
  }
}
