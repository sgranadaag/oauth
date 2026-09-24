import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@common/decorators/swaggerDocs.decorator';
import { AdminGuard } from '@common/guards/admin.guard';
import { ClientService } from './client.service';
import { CLIENT_SWAGGER } from './client.swagger';
import { CreateClientDto } from './dto/createClient.dto';
import { ClientResponseDto } from './dto/clientResponse.dto';

@ApiTags(CLIENT_SWAGGER.API_TAG)
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @SwaggerDocs(CLIENT_SWAGGER.CREATE, ClientResponseDto)
  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    const { client, plainSecret } = await this.clientService.create({
      name: dto.name,
      allowedScopes: dto.allowedScopes,
      redirectUris: dto.redirectUris ?? [],
      isPublic: dto.isPublic,
      grantTypes: dto.grantTypes,
      accessTokenTtlSeconds: dto.accessTokenTtlSeconds,
    });

    return ClientResponseDto.fromEntity(client, plainSecret);
  }
}
