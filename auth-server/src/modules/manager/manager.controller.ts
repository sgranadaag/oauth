import { Controller, Delete, Header, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@common/decorators/swaggerDocs.decorator';
import { AdminGuard } from '@common/guards/admin.guard';
import { ManagerService } from '@modules/manager/manager.service';
import { MANAGER_SWAGGER } from '@modules/manager/manager.swagger';
import type { ClearedRecords } from '@modules/manager/interfaces/manager.interface';

@ApiTags(MANAGER_SWAGGER.API_TAG)
@Controller('manager')
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @SwaggerDocs(MANAGER_SWAGGER.CLEAR_ALL)
  @UseGuards(AdminGuard)
  @Delete('oauth-records')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  clearAll(): Promise<ClearedRecords> {
    return this.managerService.clearAll();
  }
}
