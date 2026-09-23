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
import { SUPPORTED_GRANT_TYPES } from '@modules/oauth/grant/grant.constants';
import { MIN_ACCESS_TOKEN_TTL_SECONDS } from '@modules/client/client.constants';
import { CLIENT_PROPERTY_SWAGGER } from '@modules/client/client.swagger';

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
