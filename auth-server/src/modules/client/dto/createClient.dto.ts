import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { GRANT_TYPES } from '@modules/oauth/grantTypes/grantTypes.registry';
import { MIN_ACCESS_TOKEN_TTL_SECONDS } from '../client.constants';
import { CLIENT_PROPERTY_SWAGGER } from '../client.swagger';

const SUPPORTED_GRANT_TYPES = GRANT_TYPES.map((grant) => grant.type);

export class CreateClientDto {
  @ApiProperty(CLIENT_PROPERTY_SWAGGER.NAME)
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.ALLOWED_SCOPES)
  @IsArray()
  @IsString({ each: true })
  allowedScopes: string[];

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.REDIRECT_URIS)
  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  redirectUris?: string[];

  // Checked against the registry, so a typo is a 400 here rather than an
  // `unauthorized_client` at the token endpoint later.
  @ApiProperty(CLIENT_PROPERTY_SWAGGER.GRANT_TYPES)
  @IsOptional()
  @IsArray()
  @IsIn(SUPPORTED_GRANT_TYPES, { each: true })
  grantTypes?: string[];

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.ACCESS_TOKEN_TTL_SECONDS)
  @IsOptional()
  @IsInt()
  @Min(MIN_ACCESS_TOKEN_TTL_SECONDS)
  accessTokenTtlSeconds?: number;
}
