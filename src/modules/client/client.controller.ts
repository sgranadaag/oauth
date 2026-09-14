import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@decorators/swaggerDocs.decorator';
import { AdminGuard } from '@guards/admin.guard';
import { ClientService } from '@modules/client/client.service';
import { CLIENT_SWAGGER } from '@modules/client/client.swagger';
import { CreateClientDto } from '@modules/client/dto/createClient.dto';
import { ClientResponseDto } from '@modules/client/dto/clientResponse.dto';

@ApiTags(CLIENT_SWAGGER.API_TAG)
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @SwaggerDocs(CLIENT_SWAGGER.CREATE, ClientResponseDto)
  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    const { client, plainSecret } = await this.clientService.create(
      dto.name,
      dto.allowedScopes,
    );
    return ClientResponseDto.fromEntity(client, plainSecret);
  }
}
