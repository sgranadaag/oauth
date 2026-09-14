import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@decorators/swaggerDocs.decorator';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import { BearerTokenGuard } from '@guards/bearerToken.guard';
import type {
  BasicTokenRequest,
  BearerTokenRequest,
} from '@interfaces/authenticatedRequest.interface';
import { UserService } from '@modules/user/user.service';
import { USER_SWAGGER } from '@modules/user/user.swagger';
import { SignupDto } from '@modules/user/dto/signup.dto';
import { ChangePasswordDto } from '@modules/user/dto/changePassword.dto';
import { UserResponseDto } from '@modules/user/dto/userResponse.dto';

@ApiTags(USER_SWAGGER.API_TAG)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SwaggerDocs(USER_SWAGGER.SIGNUP, UserResponseDto)
  @UseGuards(BasicTokenGuard)
  @Post('signup')
  async signup(
    @Req() request: BasicTokenRequest,
    @Body() dto: SignupDto,
  ): Promise<UserResponseDto> {
    const { user, allowedScopes } = await this.userService.signup(
      request.clientId,
      dto.username,
      dto.password,
    );
    return UserResponseDto.fromEntity(user, allowedScopes);
  }

  @SwaggerDocs(USER_SWAGGER.DELETE)
  @UseGuards(BasicTokenGuard)
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: BasicTokenRequest,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.userService.remove(request.clientId, userId);
  }

  @SwaggerDocs(USER_SWAGGER.CHANGE_PASSWORD)
  @UseGuards(BearerTokenGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() request: BearerTokenRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.userService.changePassword(
      request.token,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
